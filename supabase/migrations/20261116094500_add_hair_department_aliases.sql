-- Add a broad hair-care phrase to Beauty without letting it collide with "car".
insert into public.marketplace_taxonomy_aliases (term, language, node_id)
select v.term, 'en', 'beauty-personal-care'
from (values ('hair'), ('haircare'), ('hair care'), ('hair products')) as v(term)
where not exists (
  select 1 from public.marketplace_taxonomy_aliases a
  where a.normalized_term = regexp_replace(lower(v.term), '[^a-z0-9]+', ' ', 'g')
    and a.node_id = 'beauty-personal-care'
);
