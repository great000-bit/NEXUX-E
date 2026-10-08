import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEmail } from './email.ts'
import { ADMIN_TEMPLATES, composeEmail, STATUS_TEMPLATES, type EmailJob } from './status-emails.ts'
import { buildSendBody } from './logic.ts'

const opts = { siteUrl: 'https://register.nexuse.org' }
const job = (template: string, payload: Record<string, unknown> = {}): EmailJob => ({
  template,
  expert_id: 'NEX-000042',
  full_name: 'Ada Obi',
  title: 'Dr',
  payload,
})
const noDashes = (s: string) => !new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`).test(s)

test('regression: the confirmation email is exactly what it was before status emails existed', () => {
  const before = buildEmail({ expert_id: 'NEX-000042', full_name: 'Ada Obi', title: 'Dr' }, opts)
  const now = composeEmail(job('registration_confirmation'), opts)
  assert.deepEqual(now, before)
  assert.equal(now.subject, 'You are registered: your NEXUS-E Expert ID')
})

test('every status email has a subject, a greeting, a sign-off and no dashes', () => {
  const subjects = new Set<string>()
  for (const t of STATUS_TEMPLATES) {
    const mail = composeEmail(job(t, { message: 'Please add a clearer scan.' }), opts)
    subjects.add(mail.subject)
    assert.ok(mail.text.startsWith('Dear Dr Ada Obi,'), t)
    assert.ok(mail.text.includes('The NEXUS-E team'), t)
    assert.ok(mail.html.includes('#06361e') && mail.html.includes('#c5dc3f'), t)
    for (const part of [mail.subject, mail.text, mail.html]) assert.ok(noDashes(part), `${t} has a dash`)
  }
  assert.equal(subjects.size, STATUS_TEMPLATES.length, 'each email has its own subject')
})

test('evidence received: says Under review and promises nothing it cannot keep', () => {
  const mail = composeEmail(job('verification_received'), opts)
  assert.equal(mail.subject, 'We have received your evidence: NEXUS-E')
  assert.match(mail.text, /Under review/)
  assert.match(mail.text, /nothing more you need to do/i)
})

test('more evidence needed: shows the reviewer message and a link back to sign in', () => {
  const mail = composeEmail(job('verification_more_evidence', { message: 'Your licence photo is cut off.\nPlease send the full page.' }), opts)
  assert.match(mail.subject, /more evidence/i)
  assert.ok(mail.text.includes('Your licence photo is cut off.\nPlease send the full page.'))
  assert.ok(mail.html.includes('Your licence photo is cut off.'))
  assert.ok(mail.text.includes('https://register.nexuse.org/verify'))
  assert.ok(mail.html.includes('href="https://register.nexuse.org/verify"'))
})

test('verified: congratulates, shows the Expert ID', () => {
  const mail = composeEmail(job('verification_verified'), opts)
  assert.equal(mail.subject, 'You are now a Verified Expert on NEXUS-E')
  assert.match(mail.text, /Congratulations/)
  assert.ok(mail.text.includes('NEX-000042'))
})

test('not verified: kind wording, shows the reason, keeps registration, mentions deletion', () => {
  const mail = composeEmail(job('verification_not_verified', { message: 'The certificate was unreadable.' }), opts)
  assert.equal(mail.subject, 'An update on your NEXUS-E verification')
  assert.match(mail.text, /Thank you for the time you took/)
  assert.ok(mail.text.includes('The certificate was unreadable.'))
  assert.match(mail.text, /registration remains in place/)
  assert.match(mail.text, /delete them/)
  assert.ok(!/rejected|failed|denied/i.test(mail.text), 'avoids harsh words')
})

test('not verified: only offers an email address when one is configured', () => {
  const without = composeEmail(job('verification_not_verified', { message: 'x' }), opts)
  assert.match(without.text, /contact the NEXUS-E team/)
  const withContact = composeEmail(job('verification_not_verified', { message: 'x' }), { ...opts, contactEmail: 'help@nexuse.org' })
  assert.ok(withContact.text.includes('help@nexuse.org'))
})

test('messages are escaped in HTML and trimmed to a sensible length', () => {
  const mail = composeEmail(job('verification_more_evidence', { message: '<script>alert(1)</script>' + 'x'.repeat(5000) }), opts)
  assert.ok(!mail.html.includes('<script>'))
  assert.ok(mail.html.includes('&lt;script&gt;'))
  assert.ok(mail.text.length < 3000)
})

test('an unknown template is an error, so the sender can give up on that row', () => {
  assert.throws(() => composeEmail(job('mystery'), opts), /Unknown email template/)
})

test('every email carries a Reply-To header when one is configured, and none when it is not', () => {
  const base = { from: 'NEXUS-E <noreply@nexuse.org>', to: 'ada@example.org', subject: 's', html: '<p>h</p>', text: 't' }
  const withReply = buildSendBody({ ...base, replyTo: 'help@nexuse.org' })
  assert.equal(withReply.reply_to, 'help@nexuse.org')
  assert.deepEqual(withReply.to, ['ada@example.org'])
  assert.ok(!('reply_to' in buildSendBody(base)))
  assert.ok(!('reply_to' in buildSendBody({ ...base, replyTo: '' })))
})

const OPP_ID = '0b6f3f3e-6a52-4c9e-9a3a-5b3e0f1d2c44'

test('opportunity interest: goes to the admin, names the expert and the opportunity, links to it, no contact details', () => {
  const mail = composeEmail(job('opportunity_interest', { opportunity_id: OPP_ID, opportunity_title: 'Wetland survey, Delta' }), opts)
  assert.ok(ADMIN_TEMPLATES.includes('opportunity_interest'))
  assert.ok(!STATUS_TEMPLATES.includes('opportunity_interest'), 'the expert facing list is unchanged')
  assert.ok(mail.text.startsWith('Hello,'))
  assert.ok(!mail.text.includes('Dear'))
  assert.ok(mail.subject.includes('Ada Obi') && mail.subject.includes('Wetland survey, Delta'))
  assert.ok(mail.text.includes('Dr Ada Obi (NEX-000042)'))
  assert.ok(mail.text.includes(`https://register.nexuse.org/admin/opportunities/${OPP_ID}`))
  assert.ok(mail.html.includes('administrator of NEXUS-E'))
  assert.ok(!mail.html.includes('because you registered'))
  assert.ok(!/@|\+234|phone/i.test(mail.text), 'the email carries no email address or phone number')
  for (const part of [mail.subject, mail.text, mail.html]) assert.ok(noDashes(part), 'no dashes')
})

test('opportunity interest: a title with line breaks or markup cannot break the subject or the page', () => {
  const title = ['Survey', 'Bcc: x@y.z <b>hi</b>'].join(String.fromCharCode(13, 10))
  const mail = composeEmail(job('opportunity_interest', { opportunity_id: 'not-an-id', opportunity_title: title }), opts)
  assert.ok(![13, 10].some((code) => mail.subject.includes(String.fromCharCode(code))))
  assert.ok(!mail.html.includes('<b>hi</b>'))
  assert.ok(mail.text.includes('https://register.nexuse.org/admin/opportunities'))
  assert.ok(!mail.text.includes('not-an-id'), 'a bad id is never put in the link')
})
