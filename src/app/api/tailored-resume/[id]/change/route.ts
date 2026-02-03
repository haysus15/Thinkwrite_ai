// Change Status API Route - Accept/Reject Individual Changes
// src/app/api/tailored-resume/[id]/change/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import type { ResumeChange } from '@/types/tailored-resume';

// PATCH: Update a single change's status (accept or reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id: tailoredResumeId } = await params;
    const body = await request.json();
    const { changeId, status } = body;

    if (!changeId || !status) {
      return Errors.validationError('changeId and status are required');
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return Errors.validationError('status must be "accepted" or "rejected"');
    }

    // Fetch current tailored resume - verify ownership
    const { data: tailoredResume, error: fetchError } = await supabase
      .from('tailored_resumes')
      .select('changes, changes_accepted, changes_rejected, changes_pending')
      .eq('id', tailoredResumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !tailoredResume) {
      return NextResponse.json(
        { error: 'Tailored resume not found' },
        { status: 404 }
      );
    }

    // Find and update the specific change
    const changes: ResumeChange[] = tailoredResume.changes || [];
    const changeIndex = changes.findIndex(c => c.id === changeId);

    if (changeIndex === -1) {
      return NextResponse.json(
        { error: 'Change not found' },
        { status: 404 }
      );
    }

    const previousStatus = changes[changeIndex].status;
    
    // Update the change
    changes[changeIndex] = {
      ...changes[changeIndex],
      status,
      ...(status === 'accepted' ? { acceptedAt: new Date().toISOString() } : {}),
      ...(status === 'rejected' ? { rejectedAt: new Date().toISOString() } : {})
    };

    // Recalculate counts
    let accepted = tailoredResume.changes_accepted || 0;
    let rejected = tailoredResume.changes_rejected || 0;
    let pending = tailoredResume.changes_pending || 0;

    // Adjust counts based on previous and new status
    if (previousStatus === 'pending') {
      pending = Math.max(0, pending - 1);
    } else if (previousStatus === 'accepted') {
      accepted = Math.max(0, accepted - 1);
    } else if (previousStatus === 'rejected') {
      rejected = Math.max(0, rejected - 1);
    }

    if (status === 'accepted') {
      accepted += 1;
    } else if (status === 'rejected') {
      rejected += 1;
    }

    // Update the database - verify ownership
    const { data: updated, error: updateError } = await supabase
      .from('tailored_resumes')
      .update({
        changes,
        changes_accepted: accepted,
        changes_rejected: rejected,
        changes_pending: pending,
        updated_at: new Date().toISOString()
      })
      .eq('id', tailoredResumeId)
      .eq('user_id', userId)
      .select('changes, changes_accepted, changes_rejected, changes_pending')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update change status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      change: changes[changeIndex],
      counts: {
        accepted: updated.changes_accepted,
        rejected: updated.changes_rejected,
        pending: updated.changes_pending
      }
    });

  } catch (error) {
    console.error('Change status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Bulk update multiple changes at once
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id: tailoredResumeId } = await params;
    const body = await request.json();
    const { action, changeIds } = body;

    if (!action || !['acceptAll', 'rejectAll', 'acceptSelected', 'rejectSelected'].includes(action)) {
      return Errors.validationError('Invalid action. Use: acceptAll, rejectAll, acceptSelected, rejectSelected');
    }

    // Fetch current tailored resume - verify ownership
    const { data: tailoredResume, error: fetchError } = await supabase
      .from('tailored_resumes')
      .select('changes')
      .eq('id', tailoredResumeId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !tailoredResume) {
      return NextResponse.json(
        { error: 'Tailored resume not found' },
        { status: 404 }
      );
    }

    const changes: ResumeChange[] = tailoredResume.changes || [];
    const timestamp = new Date().toISOString();

    // Apply bulk action
    let updatedChanges: ResumeChange[];

    if (action === 'acceptAll') {
      updatedChanges = changes.map(c => ({
        ...c,
        status: 'accepted' as const,
        acceptedAt: c.status === 'pending' ? timestamp : c.acceptedAt
      }));
    } else if (action === 'rejectAll') {
      updatedChanges = changes.map(c => ({
        ...c,
        status: 'rejected' as const,
        rejectedAt: c.status === 'pending' ? timestamp : c.rejectedAt
      }));
    } else if (action === 'acceptSelected' && changeIds?.length) {
      updatedChanges = changes.map(c => {
        if (changeIds.includes(c.id) && c.status === 'pending') {
          return { ...c, status: 'accepted' as const, acceptedAt: timestamp };
        }
        return c;
      });
    } else if (action === 'rejectSelected' && changeIds?.length) {
      updatedChanges = changes.map(c => {
        if (changeIds.includes(c.id) && c.status === 'pending') {
          return { ...c, status: 'rejected' as const, rejectedAt: timestamp };
        }
        return c;
      });
    } else {
      updatedChanges = changes;
    }

    // Recalculate counts
    const accepted = updatedChanges.filter(c => c.status === 'accepted').length;
    const rejected = updatedChanges.filter(c => c.status === 'rejected').length;
    const pending = updatedChanges.filter(c => c.status === 'pending').length;

    // Update database - verify ownership
    const { error: updateError } = await supabase
      .from('tailored_resumes')
      .update({
        changes: updatedChanges,
        changes_accepted: accepted,
        changes_rejected: rejected,
        changes_pending: pending,
        updated_at: timestamp
      })
      .eq('id', tailoredResumeId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Bulk update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update changes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      counts: { accepted, rejected, pending },
      message: `${action} completed successfully`
    });

  } catch (error) {
    console.error('Bulk change API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}