-- Enable vector extension
create extension if not exists vector;

-- Create documents table (Parents)
create table if not exists documents (
  id uuid primary key, -- passed from client or generated
  org_id uuid not null, 
  project_id uuid,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on documents
alter table documents enable row level security;
create policy "Public documents access" on documents for select using (true);
create policy "Public documents insert" on documents for insert with check (true);

-- Create document_chunks table (Children)
create table if not exists document_chunks (
  id bigserial primary key,
  document_id uuid references documents(id) on delete cascade,
  org_id uuid not null,
  project_id uuid,
  content text,
  embedding vector(1536) -- OpenAI text-embedding-3-small matches 1536 dimensions
);

-- Enable RLS on chunks
alter table document_chunks enable row level security;
create policy "Public chunks access" on document_chunks for select using (true);
create policy "Public chunks insert" on document_chunks for insert with check (true);
create policy "Public chunks delete" on document_chunks for delete using (true);

-- Create index for faster search (optional but recommended)
-- Note: IVFFlat requires some data to be effective, usually created after some data ingestion.
-- create index on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create match_documents function for RPC
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.document_id as id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  -- Filter by org_id (required)
  and document_chunks.org_id = (filter->>'org_id')::uuid
  -- Filter by project_id (optional)
  and (
      (filter->>'project_id') is null 
      or 
      document_chunks.project_id = (filter->>'project_id')::uuid
  )
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
