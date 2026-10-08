import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkFile, detectType, extensionOf, MAX_BYTES } from './filecheck.ts'
import { codeHash, ipHash, isPlausibleEmail, normaliseEmail, randomCode, randomHex, sha256Hex } from './hash.ts'
import { buildCodeEmail, buildSendBody, CODE_SUBJECT, greeting } from './mail.ts'

const bytes = (...b: number[]) => new Uint8Array(b)
const text = (s: string) => new TextEncoder().encode(s)
const pad = (head: Uint8Array, total = 200) => {
  const out = new Uint8Array(total)
  out.set(head)
  return out
}

const PDF = pad(text('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'))
const JPEG = pad(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46))
const PNG = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))

test('accepts real PDF, JPEG and PNG files by their contents', () => {
  const pdf = checkFile(PDF)
  const jpg = checkFile(JPEG)
  const png = checkFile(PNG)
  assert.ok(pdf.ok && pdf.type.mime === 'application/pdf')
  assert.ok(jpg.ok && jpg.type.mime === 'image/jpeg')
  assert.ok(png.ok && png.type.mime === 'image/png')
})

test('rejects files that only pretend to be allowed types', () => {
  const cases: Record<string, Uint8Array> = {
    'html page': text('<!doctype html><script>alert(1)</script>'),
    svg: text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    'zip or docx': pad(bytes(0x50, 0x4b, 0x03, 0x04)),
    'windows program': pad(bytes(0x4d, 0x5a, 0x90, 0x00)),
    'plain text': text('hello, this is not a certificate'),
    gif: pad(text('GIF89a')),
  }
  for (const [name, data] of Object.entries(cases)) {
    const r = checkFile(data)
    assert.ok(!r.ok && r.code === 'bad_type', `${name} should be rejected`)
  }
})

test('rejects empty files and files over 5 MB', () => {
  const empty = checkFile(new Uint8Array(0))
  assert.ok(!empty.ok && empty.code === 'empty')
  const big = new Uint8Array(MAX_BYTES + 1)
  big.set(PNG)
  const r = checkFile(big)
  assert.ok(!r.ok && r.code === 'too_large')
  const exactly = new Uint8Array(MAX_BYTES)
  exactly.set(PNG)
  assert.ok(checkFile(exactly).ok, 'exactly 5 MB is allowed')
})

test('rejects PDFs that carry scripts or launch actions', () => {
  const withJs = pad(text('%PDF-1.4\n1 0 obj\n<< /S /JavaScript /JS (app.alert(1)) >>\nendobj\n'), 300)
  const withLaunch = pad(text('%PDF-1.4\n1 0 obj\n<< /S /Launch /F (cmd.exe) >>\nendobj\n'), 300)
  for (const f of [withJs, withLaunch]) {
    const r = checkFile(f)
    assert.ok(!r.ok && r.code === 'active_content')
  }
})

test('detectType ignores the file name entirely', () => {
  assert.equal(detectType(PDF)?.ext, 'pdf')
  assert.equal(detectType(text('MZ not a pdf.pdf')), null)
  assert.equal(extensionOf('Certificate.PDF'), 'pdf')
  assert.equal(extensionOf('no-extension'), '')
})

test('every rejection message is friendly and has no dashes', () => {
  const messages = [new Uint8Array(0), text('x'), pad(text('%PDF-1.4 /JavaScript'))].map((b) => {
    const r = checkFile(b)
    return r.ok ? '' : r.message
  })
  for (const m of messages) {
    assert.ok(m.length > 20)
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`).test(m))
  }
})

test('hashes are stable and sign-in codes are six digits', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(await codeHash('pep', ' Ada@Example.org ', '123456'), await codeHash('pep', 'ada@example.org', '123456'))
  assert.notEqual(await codeHash('pep', 'ada@example.org', '123456'), await codeHash('pep', 'ada@example.org', '123457'))
  assert.notEqual(await ipHash('a', '1.2.3.4'), await ipHash('b', '1.2.3.4'))
  const codes = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const c = randomCode()
    assert.match(c, /^\d{6}$/)
    codes.add(c)
  }
  assert.ok(codes.size > 150, 'codes are not repeating')
  assert.match(randomHex(32), /^[0-9a-f]{64}$/)
})

test('email checks', () => {
  assert.equal(normaliseEmail('  A@B.ORG '), 'a@b.org')
  assert.ok(isPlausibleEmail('ada@example.org'))
  for (const bad of ['', 'ada', 'ada@', '@x.org', 'a b@x.org', 'ada@x']) assert.ok(!isPlausibleEmail(bad), bad)
})

test('sign-in code email: shows the code, escapes the name, no dashes', () => {
  const mail = buildCodeEmail({ title: 'Dr', fullName: '<b>Ada</b> Obi', code: '048213' })
  assert.equal(mail.subject, CODE_SUBJECT)
  assert.ok(mail.text.includes('048213') && mail.html.includes('048213'))
  assert.ok(mail.text.includes('expires in 10 minutes'))
  assert.ok(!mail.html.includes('<b>Ada</b>'))
  for (const part of [mail.text, mail.html, mail.subject]) {
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`).test(part))
  }
  assert.equal(greeting('Other', 'Ada Obi'), 'Ada Obi')
  assert.equal(greeting('Dr', 'Dr Ada Obi'), 'Dr Ada Obi')
})

test('sign-in code emails also carry the Reply-To header when one is configured', () => {
  const mail = buildCodeEmail({ title: 'Dr', fullName: 'Ada Obi', code: '123456' })
  const body = buildSendBody({ from: 'NEXUS-E <noreply@nexuse.org>', to: 'ada@example.org', ...mail, replyTo: 'help@nexuse.org' })
  assert.equal(body.reply_to, 'help@nexuse.org')
  assert.ok(!('reply_to' in buildSendBody({ from: 'a', to: 'b', ...mail })))
})
