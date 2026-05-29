
-- Fix mutable search_path on match_documents
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count integer DEFAULT 5, filter jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    RETURN query SELECT kb.id, kb.content, kb.metadata, 1 - (kb.embedding <=> query_embedding) AS similarity
        FROM knowledge_base kb
        WHERE kb.metadata @> filter
        ORDER BY kb.embedding <=> query_embedding
        LIMIT match_count;
END;
$function$;

-- Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_documents(vector, integer, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_documents(vector, integer, jsonb) TO authenticated, service_role;
