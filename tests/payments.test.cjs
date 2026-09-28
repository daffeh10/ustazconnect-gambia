/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
function load(file, mocks = {}, globals = {}) {
  const filename = path.join(root, file)
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const compiled = { exports: {} }
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks, globals)
    return require(name)
  }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console: { ...console, error() {} }, Error, TypeError, Buffer, URL, Request, Response, AbortSignal, setTimeout, clearTimeout,
    process: { env: {} }, fetch: () => { throw new Error('Unexpected network call') }, ...globals,
  })(localRequire, compiled, compiled.exports)
  return compiled.exports
}

function database(tables, options = {}) {
  return {
    from(table) {
      let filters = [], operation = 'select', values, single = false, max = Infinity, offset = 0
      let orderKey = null, ascending = true
      const query = {
        select() { return query },
        eq(key, value) { filters.push((row) => row[key] === value); return query },
        neq(key, value) { filters.push((row) => row[key] !== value); return query },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query },
        is(key, value) { return query.eq(key, value) },
        lte(key, value) { filters.push((row) => row[key] <= value); return query },
        gte(key, value) { filters.push((row) => row[key] >= value); return query },
        gt(key, value) { filters.push((row) => row[key] > value); return query },
        order(key, settings) { orderKey = key; ascending = settings?.ascending !== false; return query },
        limit(n) { max = n; return query },
        range(start, end) { offset = start; max = end - start + 1; return query },
        maybeSingle() { single = true; return query }, single() { single = true; return query },
        update(value) { operation = 'update'; values = value; return query },
        insert(value) { operation = 'insert'; values = value; return query },
        upsert(value) { operation = 'upsert'; values = value; return query },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            const rows = tables[table] ||= []
            let data = rows.filter((row) => filters.every((filter) => filter(row)))
            if (operation === 'update') {
              if (options.beforeUpdate) options.beforeUpdate(table, values, rows)
              data = rows.filter((row) => filters.every((filter) => filter(row)))
              data.forEach((row) => Object.assign(row, values))
            }
            if (operation === 'insert') {
              if (table === 'payments' && values.status === 'pending' && rows.some((row) => row.booking_id === values.booking_id && row.status === 'pending')) {
                return { data: null, error: { code: '23505' } }
              }
              const row = { id: 'new-payment', created_at: new Date().toISOString(), ...values }
              rows.push(row); data = [row]
            }
            if (operation === 'upsert') {
              if (options.lessonError) return { data: null, error: options.lessonError }
              for (const row of values) if (!rows.some((item) => item.booking_id === row.booking_id && item.lesson_number === row.lesson_number)) rows.push(row)
              data = values
            }
            if (orderKey) data.sort((a, b) => String(a[orderKey]).localeCompare(String(b[orderKey])) * (ascending ? 1 : -1))
            data = data.slice(offset, offset + max)
            return { data: single ? data[0] || null : data.map((row) => ({ ...row })), error: null, count: data.length }
          }).then(resolve, reject)
        },
      }
      return query
    },
    auth: { admin: { getUserById: async () => ({ data: { user: null } }) } },
  }
}
const booking = { id: 'booking', family_id: 'family', tutor_id: 'tutor', status: 'confirmed', monthly_total: 800, service_fee: 24, grand_total: 824, hours_per_month: 8, booking_type: 'monthly', subjects: ['Maths'] }
const payment = { id: 'payment', booking_id: 'booking', family_id: 'family', amount: 800, service_fee: 24, total: 824, status: 'pending', provider_payment_id: 'request', intent_secret: 'booking:attempt:unique', provider_kind: 'request', payment_method: 'waychit', created_at: '2026-09-23T10:00:00Z', verification_error: null }
const evidence = { id: 'request', amount: 824, currency: 'GMD', paymentStatus: 'succeeded', status: 'closed', transactionReference: 'transaction', clientReference: payment.intent_secret, paidDate: '2026-09-23T11:00:00Z' }
const providerConfig = { getWaychitApiKey: () => 'test-key', getWaychitApiUrl: (p) => `https://api.waychit.com/v1${p}`, getWaychitWebhookSecret: () => 'test-secret', getSiteUrl: () => 'https://example.test' }
function setup(tables = {}, globals = {}, options = {}) {
  const db = database({ bookings: [{ ...booking }], payments: [{ ...payment }], tutor_profiles: [{ id: 'tutor', hourly_rate: 100 }], ...tables }, options)
  const mocks = { '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/payments': providerConfig,
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'family' } }, error: null }) } }) },
    '@/lib/email': { composeEmail: (lines) => lines.join('\n'), sendEmail: async () => ({ sent: true }) } }
  return { db, mocks, module: (file) => load(file, mocks, globals) }
}

const waychit = load('lib/waychit.ts', { '@/lib/payments': providerConfig })
test('only explicit success counts as paid; closed, active and unknown stay unresolved', () => {
  assert.equal(waychit.waychitPaymentState(evidence), 'completed')
  assert.equal(waychit.waychitPaymentState({ status: 'closed' }), 'review')
  assert.equal(waychit.waychitPaymentState({ status: 'active', paymentStatus: 'failed' }), 'pending')
  assert.equal(waychit.waychitPaymentState({ status: 'expired' }), 'cancelled')
  assert.equal(waychit.waychitPaymentState({ status: 'surprise' }), 'pending')
})
test('amount, currency, request and attempt references must match', () => {
  assert.doesNotThrow(() => waychit.verifyPaymentEvidence(payment, evidence))
  for (const change of [{ amount: 823 }, { amount: '824' }, { currency: 'USD' }, { id: 'other' }, { clientReference: 'other' }, { metadata: { bookingId: 'other' } }]) {
    assert.throws(() => waychit.verifyPaymentEvidence(payment, { ...evidence, ...change }))
  }
  assert.throws(() => waychit.verifyPaymentEvidence({ ...payment, provider_payment_id: null }, { ...evidence, clientReference: null }))
})
test('signature rejects tampered payloads, malformed signatures and stale events', () => {
  const now = Date.now(), t = Math.floor(now / 1000), raw = JSON.stringify(evidence)
  const sig = crypto.createHmac('sha256', 'secret').update(`${t}.${raw}`).digest('hex')
  assert.equal(waychit.verifyWaychitSignature(`t=${t},v1=${sig}`, raw, 'secret', now), true)
  assert.equal(waychit.verifyWaychitSignature(`t=${t},v1=${sig}`, raw + ' ', 'secret', now), false)
  assert.equal(waychit.verifyWaychitSignature(`t=${t},v1=${sig}xx`, raw, 'secret', now), false)
  assert.equal(waychit.verifyWaychitSignature(`t=${t},v1=${sig}`, raw, 'secret', now + 301000), false)
  assert.equal(waychit.validCheckoutUrl('https://pay.waychit.com.evil.test/pay'), null)
})
test('missed webhook recovered by provider lookup; repeated recovery never duplicates lessons', async () => {
  const tables = { payments: [{ ...payment }], bookings: [{ ...booking }], lessons: [] }
  let calls = 0
  const s = setup(tables, { fetch: async (url, init) => { calls++; assert.equal(url, 'https://api.waychit.com/v1/payment-requests/request'); assert.equal(init.cache, 'no-store'); return Response.json({ success: true, paymentRequest: evidence }) } })
  const recovery = s.module('lib/payment-reconciliation.ts')
  await recovery.reconcileBookingPayments(s.db, 'booking')
  await recovery.reconcileBookingPayments(s.db, 'booking')
  assert.equal(tables.payments[0].status, 'completed')
  assert.equal(tables.bookings[0].status, 'active')
  assert.equal(tables.lessons.length, 4)
  assert.equal(calls, 1)
})
test('late failed callback cannot downgrade success, including concurrent success', async () => {
  const tables = { payments: [{ ...payment, status: 'completed' }], bookings: [{ ...booking, status: 'active' }] }
  const s = setup(tables)
  const recovery = s.module('lib/payment-reconciliation.ts')
  await recovery.applyPaymentEvidence(s.db, payment, { ...evidence, paymentStatus: 'failed' })
  assert.equal(tables.payments[0].status, 'completed')
})
test('mismatched successful payment never activates booking', async () => {
  const tables = { payments: [{ ...payment }], bookings: [{ ...booking }] }
  const s = setup(tables, { fetch: async () => Response.json({ success: true, paymentRequest: { ...evidence, amount: 5 } }) })
  await assert.rejects(s.module('lib/payment-reconciliation.ts').reconcilePayment(s.db, tables.payments[0]), /amount or currency/)
  assert.equal(tables.bookings[0].status, 'confirmed')
  assert.equal(tables.payments[0].status, 'pending')
  assert.match(tables.payments[0].verification_error, /amount or currency/)
})
test('provider outage stays unresolved and records a diagnostic', async () => {
  const tables = { payments: [{ ...payment }] }
  const s = setup(tables, { fetch: async () => new Response('', { status: 503 }) })
  await assert.rejects(s.module('lib/payment-reconciliation.ts').reconcilePayment(s.db, tables.payments[0]), /503/)
  assert.equal(tables.payments[0].status, 'pending')
  assert.match(tables.payments[0].verification_error, /503/)
})
test('payment succeeds but lesson failure is recoverable without activating prematurely', async () => {
  const tables = { payments: [{ ...payment }], bookings: [{ ...booking }] }
  const options = { lessonError: { code: '42P10', message: 'Missing unique index' } }
  const s = setup(tables, {}, options)
  const recovery = s.module('lib/payment-reconciliation.ts')
  await assert.rejects(recovery.applyPaymentEvidence(s.db, payment, evidence))
  assert.equal(tables.payments[0].status, 'completed')
  assert.equal(tables.bookings[0].status, 'confirmed')
  options.lessonError = null
  await recovery.reconcilePayment(s.db, tables.payments[0])
  assert.equal(tables.bookings[0].status, 'active')
})
test('cancelled booking keeps successful money evidence but is not reactivated', async () => {
  const tables = { payments: [{ ...payment }], bookings: [{ ...booking, status: 'cancelled' }] }
  const s = setup(tables)
  await assert.rejects(s.module('lib/payment-reconciliation.ts').applyPaymentEvidence(s.db, payment, evidence), /review/)
  assert.equal(tables.bookings[0].status, 'cancelled')
  assert.equal(tables.payments[0].status, 'completed')
})
test('unpaid booking and trial commission display correctly; duplicate payments are flagged', () => {
  const { summarizeBookingPayments } = load('lib/admin-payments.ts')
  const unpaid = summarizeBookingPayments(booking, [])
  assert.equal(unpaid.paymentLabel, 'No payment started'); assert.equal(unpaid.amountReceived, 0)
  assert.equal(unpaid.commission, 40); assert.equal(unpaid.platformFees, 64); assert.equal(unpaid.tutorShare, 760)
  const trial = summarizeBookingPayments({ ...booking, booking_type: 'trial', monthly_total: 150, service_fee: 5, grand_total: 155 }, [])
  assert.equal(trial.commission, 0)
  const duplicate = summarizeBookingPayments(booking, [{ ...payment, status: 'completed' }, { ...payment, id: 'duplicate', status: 'completed' }])
  assert.equal(duplicate.amountReceived, 1648); assert.equal(duplicate.duplicatePayment, true)
  assert.equal(duplicate.commission, 40)
})
test('family cannot verify another family booking', async () => {
  const s = setup({ bookings: [{ ...booking, family_id: 'someone-else' }] })
  const response = await s.module('app/api/payments/confirm/route.ts').POST(new Request('http://test/confirm', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) }))
  assert.equal(response.status, 404)
})
test('webhook never falls back to a newer attempt for the same booking', async () => {
  const s = setup()
  const raw = JSON.stringify({ type: 'payment.request.completed', data: { ...evidence, id: 'older-request', clientReference: 'booking:attempt:older' } })
  const t = Math.floor(Date.now() / 1000), sig = crypto.createHmac('sha256', 'test-secret').update(`${t}.${raw}`).digest('hex')
  const response = await s.module('app/api/payments/webhook/route.ts').POST(new Request('http://test/webhook', { method: 'POST', body: raw, headers: { 'Waychit-Signature': `t=${t},v1=${sig}` } }))
  assert.equal(response.status, 500)
})
test('two checkout clicks produce only one provider creation', async () => {
  let calls = 0
  const tables = { payments: [] }
  const s = setup(tables, { fetch: async () => { calls++; return Response.json({ success: true, paymentRequest: { id: 'new-request', amount: 824, currency: 'GMD', status: 'active', waychitLaunchUrl: 'https://pay.waychit.com/payment-requests/new-request' } }) } })
  const route = s.module('app/api/payments/create-checkout/route.ts')
  const request = () => new Request('http://test/checkout', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) })
  const responses = await Promise.all([route.POST(request()), route.POST(request())])
  assert.equal(calls, 1)
  assert.equal(responses.filter((response) => response.status === 200).length, 1)
  assert.equal(responses.filter((response) => response.status === 409).length, 1)
})
test('checkout timeout leaves a trace and prevents an automatic second charge', async () => {
  let calls = 0
  const tables = { payments: [] }
  const s = setup(tables, { fetch: async () => { calls++; throw new Error('timeout') } })
  const route = s.module('app/api/payments/create-checkout/route.ts')
  const request = () => new Request('http://test/checkout', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) })
  await route.POST(request()); await route.POST(request())
  assert.equal(calls, 1); assert.equal(tables.payments.length, 1)
  assert.equal(tables.payments[0].status, 'pending'); assert.ok(tables.payments[0].verification_error)
})

test('an active checkout is reused after a declined method, without creating another request', async () => {
  let reads = 0
  const tables = { payments: [{ ...payment, checkout_url: 'https://pay.waychit.com/payment-requests/request' }] }
  const s = setup(tables, { fetch: async (_url, init) => {
    assert.notEqual(init.method, 'POST'); reads++
    return Response.json({ success: true, paymentRequest: { ...evidence, status: 'active', paymentStatus: 'failed', waychitLaunchUrl: tables.payments[0].checkout_url } })
  } })
  const response = await s.module('app/api/payments/create-checkout/route.ts').POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) }))
  assert.equal(response.status, 200); assert.equal(reads, 1)
  assert.equal((await response.json()).payment_link, tables.payments[0].checkout_url)
  assert.equal(tables.payments.length, 1)
})
test('newest unresolved attempt cannot hide an older successful attempt', async () => {
  const old = { ...payment, id: 'old', provider_payment_id: 'old-request', created_at: '2026-09-22T10:00:00Z' }
  const s = setup({ payments: [{ ...payment, provider_payment_id: null }, old] }, { fetch: async () => Response.json({ success: true, paymentRequest: { ...evidence, id: 'old-request' } }) })
  const result = await s.module('lib/payment-reconciliation.ts').reconcileBookingPayments(s.db, 'booking')
  assert.equal(result.id, 'old'); assert.equal(result.status, 'completed')
})
test('paid checkout does not create another request', async () => {
  const s = setup({ payments: [{ ...payment, status: 'completed' }], bookings: [{ ...booking, status: 'active' }] })
  const response = await s.module('app/api/payments/create-checkout/route.ts').POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) }))
  assert.equal(response.status, 200); assert.equal((await response.json()).already_paid, true)
})
test('payment history and recovery reject non-admins', async () => {
  const s = setup()
  s.mocks['@/lib/admin'] = { getAdminContext: async () => ({ admin: null }), hasAdminRole: () => false }
  const route = s.module('app/api/admin/payments/route.ts')
  assert.equal((await route.GET(new Request('http://test'))).status, 403)
  assert.equal((await route.POST(new Request('http://test', { method: 'POST', body: '{}' }))).status, 403)
})
test('financial read includes rows beyond Supabase page limits', async () => {
  const { readAllRows } = load('lib/database-pages.ts')
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id, total: 824 }))
  const result = await readAllRows(async (start, end) => ({ data: rows.slice(start, end + 1), error: null }))
  assert.equal(result.data.length, 1203)
  assert.equal(result.data.reduce((sum, row) => sum + row.total, 0), 991272)
})
test('late failure loses to a successful update during reconciliation', async () => {
  const tables = { payments: [{ ...payment }], bookings: [{ ...booking, status: 'active' }] }
  const s = setup(tables, {}, { beforeUpdate(table, values, rows) { if (table === 'payments' && values.status === 'failed') rows[0].status = 'completed' } })
  await s.module('lib/payment-reconciliation.ts').applyPaymentEvidence(s.db, payment, { ...evidence, paymentStatus: 'failed' })
  assert.equal(tables.payments[0].status, 'completed')
})

test('invalid creation amount retains provider ID for review without opening checkout', async () => {
  const tables = { payments: [] }
  const s = setup(tables, { fetch: async () => Response.json({ success: true, paymentRequest: { id: 'wrong-amount-request', amount: 5, currency: 'GMD', waychitLaunchUrl: 'https://pay.waychit.com/payment-requests/wrong-amount-request' } }) })
  const response = await s.module('app/api/payments/create-checkout/route.ts').POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ bookingId: 'booking' }) }))
  assert.equal(response.status, 502)
  assert.equal(tables.payments[0].provider_payment_id, 'wrong-amount-request')
  assert.equal(tables.payments[0].status, 'pending')
  assert.ok(tables.payments[0].verification_error)
})

test('payment reminder emails only recently accepted unpaid bookings, once', async () => {
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
  const accepted = (id, updatedAt, extra = {}) => ({ ...booking, id, family_name: 'Family', created_at: updatedAt, updated_at: updatedAt, payment_reminder_sent_at: null, ...extra })
  const { db, mocks } = setup({
    bookings: [
      accepted('recent', hoursAgo(5 * 24)),
      accepted('too-new', hoursAgo(2)),
      accepted('old-test', hoursAgo(90 * 24)),
      accepted('already-reminded', hoursAgo(3 * 24), { payment_reminder_sent_at: hoursAgo(24) }),
      accepted('paid', hoursAgo(5 * 24), { status: 'active' }),
    ],
    payments: [],
    tutor_profiles: [{ id: 'tutor', name: 'Tutor T.' }],
  })
  const sent = []
  db.auth.admin.getUserById = async () => ({ data: { user: { email: 'family@example.test' } } })
  const route = load('app/api/cron/maintenance/route.ts', {
    ...mocks,
    '@/lib/email': { composeEmail: (lines) => lines.join('\n'), sendEmail: async (input) => { sent.push(input); return { sent: true } } },
    '@/lib/trials': { queueTrialPayout: async () => false },
    '@/lib/payment-reconciliation': { recoverPendingPayments: async () => ({}) },
  }, { process: { env: { CRON_SECRET: 'cron' } } })
  const call = () => route.GET(new Request('https://example.test/api/cron/maintenance', { headers: { authorization: 'Bearer cron' } }))

  const body = await (await call()).json()
  assert.equal(body.paymentRemindersSent, 1)
  assert.equal(sent.length, 1)
  assert.match(sent[0].text, /\/payment\/recent/)
  assert.match(sent[0].text, /GMD 824/)
  assert.ok(db.from && (await db.from('bookings').select().eq('id', 'recent').maybeSingle()).data.payment_reminder_sent_at)

  const second = await (await call()).json()
  assert.equal(second.paymentRemindersSent, 0)
  assert.equal(sent.length, 1)
})
