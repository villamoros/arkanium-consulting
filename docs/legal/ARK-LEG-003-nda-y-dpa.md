# ARK-LEG-003 — Mutual NDA and AI Use & Data Processing Addendum (drafts)

**Status:** draft for review by a New Mexico-licensed attorney. Not legal advice. Bracketed items require a decision or confirmation before use.
**Governing law:** State of New Mexico, United States.

---

## Part A — Mutual Non-Disclosure Agreement

**1. Parties.** Arkanium Consulting LLC, New Mexico, United States ("Arkanium"), and [counterparty] ("Counterparty"), each a "Party".

**2. Purpose.** The Parties wish to exchange information to evaluate a possible business relationship, including consulting services (the "Purpose").

**3. Confidential Information.** Any non-public information disclosed by one Party to the other in connection with the Purpose, in any form, that is marked confidential or that a reasonable person would understand to be confidential, including business plans, systems, architecture, pricing, customer information and personal data.

**4. Obligations.** The receiving Party will: (a) use Confidential Information only for the Purpose; (b) protect it with at least reasonable care; (c) disclose it only to employees, contractors and advisers who need to know it and are bound by equivalent obligations; (d) not reverse engineer or derive other works from it.

**5. Exclusions.** Obligations do not apply to information that is or becomes public without breach, was lawfully known to the receiving Party before disclosure, is independently developed without use of Confidential Information, or is lawfully received from a third party without restriction.

**6. Legal process.** A Party may disclose Confidential Information if required by law, after giving prompt notice where lawful and reasonable assistance to limit disclosure.

**7. Term.** The Agreement lasts [two] years from the effective date. Obligations for trade secrets survive as long as the information remains a trade secret. Other obligations survive [three] years after termination.

**8. Return or destruction.** On request, the receiving Party returns or destroys Confidential Information, except copies kept in automatic backups or required by law, which remain subject to this Agreement.

**9. No license.** No rights or licenses are granted except as expressly stated. Information is provided "as is".

**10. No obligation to proceed.** Neither Party is obliged to enter into any further agreement. Any agreement for services will be a separate written agreement.

**11. Remedies.** Unauthorized use or disclosure may cause irreparable harm. The disclosing Party may seek injunctive relief in addition to other remedies.

**12. Governing law.** The laws of the State of New Mexico apply. [Forum: as in ARK-LEG-002, Section 19.]

**13. General.** Entire agreement on its subject. Amendments in writing and signed. Electronic signatures are valid.

**Signatures.** Per the parties' signature blocks.

---

## Part B — AI Use & Data Processing Addendum

This Addendum forms part of the MSA between Arkanium and Client when Arkanium processes personal data for Client or uses automated agents in the Services.

**1. Roles.** For personal data that Client provides or that Arkanium collects for Client's engagement, Client is the controller and Arkanium is the processor. For Arkanium's own marketing, lead and contact data, Arkanium is the controller. [Counsel to confirm the role analysis for each data flow.]

**2. Purpose and instructions.** Arkanium processes personal data only to perform the Services and as Client instructs in writing. Arkanium will inform Client if an instruction appears to violate applicable law.

**3. Categories of data and subjects.** [To be completed per SOW: e.g., business contact details, employee names and roles, system information, and other data needed for the Services.] Arkanium does not request sensitive personal data unless the SOW says so and appropriate safeguards are in place.

**4. Automated agents and human oversight.**
(a) Automated agents may read, summarize and draft content from data that Arkanium holds for the engagement.
(b) Arkanium personnel review every output before it is delivered to Client. No output is sent to third parties on Client's behalf without that review and Client's instruction.
(c) Agents do not make decisions that produce legal or similarly significant effects on individuals.
(d) Arkanium keeps an activity log of agent actions relevant to the engagement and makes relevant entries available to Client on request.

**5. Model providers.** Arkanium may use third-party AI model providers to run agents. Arkanium will: (a) use only providers whose terms prohibit using Client data to train their general models, unless Client opts in in writing; (b) restrict data sent to providers to what the task requires; (c) list the providers used in the Subprocessor list. [Counsel to confirm provider terms before first use.]

**6. Subprocessors.** Client authorizes the subprocessors in Schedule 1. Arkanium will give at least [30] days' notice before adding a subprocessor that processes Client personal data, and Client may object on reasonable data protection grounds.

**7. Security.** Arkanium maintains reasonable administrative, technical and physical safeguards appropriate to the data, including access controls by role and by project, encryption in transit, secrets management, and activity logging.

**8. Personnel.** Personnel with access are bound by confidentiality obligations and receive training appropriate to their role.

**9. Security incidents.** Arkanium will notify Client without undue delay and in any event within [72] hours after confirming a personal data breach affecting Client data, with information reasonably available to help Client meet its own obligations.

**10. Assistance.** Arkanium will reasonably assist Client with data subject requests, impact assessments and regulatory inquiries relating to the Services.

**11. Transfers.** Arkanium is located in the United States. If Client is located outside the United States and transfers are subject to transfer rules, the Parties will sign the applicable transfer mechanism before transfer. [Counsel to confirm.]

**12. Retention and deletion.** Arkanium retains personal data for the duration of the engagement and for [the period stated in the SOW or required by law]. On termination, at Client's choice, Arkanium deletes or returns personal data, except backups and records it must keep by law, which remain protected.

**13. Audits.** Client may request information to verify compliance, once per year, with reasonable notice. Arkanium may satisfy that request with a written summary of its security controls.

**14. Conflicts and precedence.** If this Addendum conflicts with the MSA on personal data, this Addendum controls.

---

## Schedule 1 — Subprocessors (current)

| Subprocessor | Purpose | Location | Status |
| --- | --- | --- | --- |
| Clerk | Sign-in, organization membership | United States | In use |
| Supabase | Database | [region to confirm] | In use (production when launched) |
| Stripe | Payments and invoices | United States | Planned |
| Cloudflare | Hosting, web functions, security | United States / global | In use |
| Resend | Transactional email | United States | In use (contact form, after activation) |
| Slack | Internal alerts to Arkanium | United States | In use (contact form, after activation) |
| AI model provider | Agent processing | [to be selected] | Not yet in use. Requires this list to be updated before use. |
| Agent orchestrator | Agent coordination | [to be selected: Hermes or OpenClaw] | Not yet in use |

Each row must be updated before the service it supports processes Client data.
