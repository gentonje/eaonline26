-- Give broad vehicle language an exact Automotive taxonomy route.
-- This prevents "car" from being inferred from unrelated compound labels such as "car seat" or "carpet care".
insert into public.marketplace_taxonomy_aliases (term, language, node_id)
select v.term, 'en', 'automotive-transport'
from (values ('car'), ('cars'), ('vehicle'), ('vehicles'), ('automobile'), ('automobiles')) as v(term)
where not exists (
  select 1
  from public.marketplace_taxonomy_aliases a
  where a.normalized_term = v.term
    and a.node_id = 'automotive-transport'
);
