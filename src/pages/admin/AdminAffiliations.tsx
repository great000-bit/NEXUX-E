import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Row = {
  id: string
  kind: 'professional' | 'ngo'
  name: string
  acronym: string | null
  institution_status: 'approved' | 'pending'
  membership_category: string | null
  membership_number: string | null
  licence_status: string | null
  affiliation_type: string | null
  declaration: string
  evidence_status: string
}

const TYPE: Record<string, string> = { employee: 'Employee', consultant: 'Consultant', member: 'Member', volunteer: 'Volunteer', board_member: 'Board member', partner: 'Partner' }
const EVIDENCE: Record<string, string> = { registered: 'Registered', evidence_submitted: 'Evidence Submitted', verified: 'Verified' }

/**
 * What an expert declared, for the admin who reviews them. Membership numbers and licence details are private: they are
 * shown here and to the expert, and nowhere else. Everything is self-declared, and naming an organisation never verifies anyone.
 */
export function AdminAffiliations({ expertId, publicConsent }: { expertId: string; publicConsent: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    supabase.rpc('admin_expert_affiliations', { p_expert_id: expertId }).then(({ data, error }) => {
      if (!live) return
      if (error) setFailed(true)
      else setRows(data as Row[])
    })
    return () => {
      live = false
    }
  }, [expertId])

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="aff-h">
      <h2 id="aff-h" className="text-xl font-semibold text-green-900">Memberships and affiliations</h2>
      <p className="mt-1 text-sm text-ink-700">
        Self-declared by the expert and not checked. Membership numbers and licence details are private. Shown on the public
        profile (without numbers) only if the expert agreed: {publicConsent ? 'they agreed.' : 'they did not.'}
      </p>
      {failed && <p className="mt-3 text-sm text-danger-600">Could not load the affiliations.</p>}
      {!rows && !failed && <p className="mt-3 text-sm text-ink-500">Loading...</p>}
      {rows && rows.length === 0 && <p className="mt-3 text-sm text-ink-500">None declared.</p>}
      {rows && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-500">
                <th className="py-2 pe-3 text-start">Institution</th>
                <th className="py-2 pe-3 text-start">Type</th>
                <th className="py-2 pe-3 text-start">Category or connection</th>
                <th className="py-2 pe-3 text-start">Membership number</th>
                <th className="py-2 pe-3 text-start">Licence or status</th>
                <th className="py-2 text-start">Evidence status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pe-3">
                    <span className="font-semibold text-ink-900">{r.name}</span>
                    {r.institution_status === 'pending' && <span className="ms-2 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-bold text-[#7a4b00]">Pending review</span>}
                  </td>
                  <td className="py-2 pe-3">{r.kind === 'ngo' ? 'Environmental NGO' : 'Professional body'}</td>
                  <td className="py-2 pe-3">{r.kind === 'ngo' ? (r.affiliation_type ? TYPE[r.affiliation_type] ?? r.affiliation_type : '') : (r.membership_category ?? '')}</td>
                  <td className="py-2 pe-3">{r.membership_number ?? ''}</td>
                  <td className="py-2 pe-3">{r.licence_status ?? ''}</td>
                  <td className="py-2">{EVIDENCE[r.evidence_status] ?? r.evidence_status} <span className="text-ink-500">(self-declared)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
