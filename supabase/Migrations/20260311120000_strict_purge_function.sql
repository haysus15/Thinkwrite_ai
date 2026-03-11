-- Atomic strict purge for Mirror Mode user data.
-- SECURITY DEFINER allows the function to run as owner while keeping caller auth checks in API route.

CREATE OR REPLACE FUNCTION public.strict_purge_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete dependency records first.
  DELETE FROM public.mirror_extension_activity WHERE user_id = p_user_id;
  DELETE FROM public.mirror_learning_activity WHERE user_id = p_user_id;
  DELETE FROM public.mirror_generations WHERE user_id = p_user_id;

  DELETE FROM public.mirror_mode_blend_consent WHERE user_id = p_user_id;
  DELETE FROM public.mirror_mode_consent_history WHERE user_id = p_user_id;
  DELETE FROM public.mirror_mode_consent WHERE user_id = p_user_id;
  DELETE FROM public.mirror_mode_settings WHERE user_id = p_user_id;

  DELETE FROM public.voice_chambers WHERE user_id = p_user_id;
  DELETE FROM public.voice_profile_epochs WHERE user_id = p_user_id;
  DELETE FROM public.voice_profiles WHERE user_id = p_user_id;

  DELETE FROM public.mirror_document_content
  WHERE document_id IN (
    SELECT id FROM public.mirror_documents WHERE user_id = p_user_id
  );

  DELETE FROM public.mirror_documents WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.strict_purge_user_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.strict_purge_user_data(uuid) TO authenticated;

