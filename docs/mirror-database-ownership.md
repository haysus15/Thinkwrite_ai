Three sections:

Platform tables — shared across all of ThinkWrite, never to be owned by a single Mirror surface: voice_chambers, voice_profiles, mirror_context_memory, mirror_domain_rules, mirror_extension_activity, mirror_playground_sessions
Contested tables — both legacy and v2 have active write paths, require handoff sequencing before any Supabase changes: mirror_documents, mirror_document_content, mirror_mode_consent, mirror_subcategories, mirror_unclassified_queue, user_profiles
Handoff rule — no Supabase changes to contested tables until: v2 write paths are confirmed complete, legacy routes are set to read-only, and regression testing passes.
