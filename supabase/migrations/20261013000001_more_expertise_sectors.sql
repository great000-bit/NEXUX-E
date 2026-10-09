-- Three new expertise sectors: Environmental Educator, Environmental IT, Environmental Media (18 in all).
--
-- Additive and safe to re-run. The only place the database holds the list of sector names is the check on
-- opportunities.expertise_needed (which also caps the number of sectors an opportunity can name at the size of the list).
-- Registration (register_expert) and the directory search do not validate sector names, so they need no change.
-- This only widens the check: every value that was allowed before is still allowed, and no data is touched.

alter table public.opportunities drop constraint if exists opportunities_expertise_needed_check;

alter table public.opportunities add constraint opportunities_expertise_needed_check check (
  cardinality(expertise_needed) between 1 and 18
  and expertise_needed <@ array[
    'ESIA and Safeguards', 'Biodiversity and Ecosystems', 'Water and Hydrogeology', 'Geology and Earth Sciences',
    'Climate Change and Carbon', 'Social and Economic Studies', 'Gender and Inclusion',
    'Pollution and Environmental Quality', 'GIS and Remote Sensing', 'Marine and Blue Economy',
    'Environmental Engineering', 'Policy, Governance and Regulation', 'ESG and Sustainability',
    'Occupational and Community Health', 'Other Specialised Expertise',
    'Environmental Educator', 'Environmental IT', 'Environmental Media']);
