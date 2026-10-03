-- Pin search_path on the remaining helper functions (Supabase advisor 0011, function_search_path_mutable).
alter function public.touch_updated_at() set search_path = public;
alter function public.fail(text) set search_path = public;
alter function public.is_open_state(engagement_state) set search_path = public;
alter function public.safe_uuid(text) set search_path = public;
alter function public.recency_boost(timestamptz) set search_path = public;
alter function public.orcid_valid(text) set search_path = public;
