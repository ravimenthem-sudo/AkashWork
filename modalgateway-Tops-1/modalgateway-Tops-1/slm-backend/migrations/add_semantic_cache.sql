-- ENABLE VECTOR EXTENSION
create extension if not exists vector;

-- CREATE SEMANTIC CACHE TABLE
create table if not exists semantic_cache (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) not null,
  
  query_text text not null,
  query_embedding vector(1536) not null, -- OpenAI text-embedding-3-small
  response_text text not null,
  
  metadata jsonb,
  org_id uuid,
  user_role text
);

-- ENABLE RLS
alter table semantic_cache enable row level security;

-- Create policy for authenticated users 
-- (In production, you'd filter by org_id strictly)
create policy "Enable access for authenticated users" 
on semantic_cache for all 
to authenticated 
using (true);

-- CREATE MATCH FUNCTION FOR SEMANTIC LOOKUP
create or replace function match_semantic_cache (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  msg_org_id uuid
)
returns table (
  id uuid,
  query_text text,
  response_text text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    semantic_cache.id,
    semantic_cache.query_text,
    semantic_cache.response_text,
    1 - (semantic_cache.query_embedding <=> query_embedding) as similarity
  from semantic_cache
  where 1 - (semantic_cache.query_embedding <=> query_embedding) > match_threshold
  and (semantic_cache.org_id = msg_org_id or semantic_cache.org_id is null)
  order by semantic_cache.query_embedding <=> query_embedding
  limit match_count;
end;
$$;
