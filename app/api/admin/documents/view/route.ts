import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, hasAdminRole } from '@/lib/admin'

interface DocumentPathRow {
  id: string
  document_url: string
}

/**
 * Mints a fresh signed URL for one tutor document and redirects to it.
 *
 * The documents list used to sign every file once when the page loaded, with a
 * 60 second expiry, so every link on the page went dead a minute later and only
 * the first attachment an admin opened actually worked. Signing on demand means
 * the link is always valid at the moment it is clicked, and the storage path is
 * never sent to the browser.
 */
export async function GET(request: Request) {
  try {
    const { admin } = await getAdminContext()
    if (!hasAdminRole(admin, ['owner', 'admin', 'quran_verifier'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const documentId = new URL(request.url).searchParams.get('id')?.trim()
    if (!documentId) {
      return NextResponse.json({ error: 'Missing document id.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: document, error: documentError } = await supabase
      .from('tutor_documents')
      .select('id,document_url')
      .eq('id', documentId)
      .maybeSingle<DocumentPathRow>()

    if (documentError) throw documentError
    if (!document?.document_url) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.document_url, 120)

    if (signedError) throw signedError
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not open this document.' }, { status: 502 })
    }

    // 302 so the browser follows straight to storage; no-store keeps the
    // short-lived URL out of any cache.
    return NextResponse.redirect(signed.signedUrl, {
      status: 302,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('admin document view failed', error)
    return NextResponse.json({ error: 'Could not open this document.' }, { status: 500 })
  }
}
