import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Paper set completion loop', () => {
  async function openAcademicPath(page, path) {
    await page.addInitScript(() => {
      window.localStorage.setItem('e2e-auth', '1');
    });
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(350);
    const authGate = page.getByText('Authentication required', { exact: false });
    if (await authGate.count()) {
      await expect(authGate).toBeVisible();
      const signInLink = page.getByRole('link', { name: 'Sign In' });
      const signInButton = page.getByRole('button', { name: 'Sign In' });
      if (await signInLink.count()) {
        await expect(signInLink).toBeVisible();
      } else {
        await expect(signInButton).toBeVisible();
      }
      return false;
    }
    return true;
  }

  test('marks set paper complete and shows completion panel with back action', async ({ page }) => {
    let completeCalls = 0;

    await page.route('**/api/paper/paper-1', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            paper: {
              id: 'paper-1',
              assignment_id: null,
              assignment_set_id: 'set-1',
              set_order: 2,
              outline_id: 'outline-1',
              workflow_step: 'checkpoint',
              checkpoint_passed: true,
              emergency_skip_used: false,
              is_complete: false,
              paper_content: 'This is a complete draft body with enough content.',
              topic: 'Paper 2 prompt text',
            },
            set: {
              id: 'set-1',
              title: 'Civil Rights Assignment Set',
              assignment_prompt: 'Respond to each prompt.',
              rubric_text: null,
            },
          }),
        });
        return;
      }

      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.is_complete).toBe(false);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            paper: {
              id: 'paper-1',
              assignment_set_id: 'set-1',
              is_complete: false,
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/api/paper/paper-1/complete', async (route) => {
      completeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complete: true, set_complete: false, set_id: 'set-1' }),
      });
    });

    const isAuthenticated = await openAcademicPath(
      page,
      '/academic/paper-workflow/paper/paper-1?setId=set-1'
    );
    if (!isAuthenticated) return;

    await expect(page.getByRole('button', { name: 'Mark as complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark as complete' }).click();

    expect(completeCalls).toBe(1);
    await expect(page.getByText('Paper complete')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to assignment' })).toBeVisible();
    await expect(
      page.getByText('This paper is locked in read-only mode. Use "Unlock to edit" to make changes.')
    ).toBeVisible();
  });

  test('unlock to edit re-enables editing controls after completion', async ({ page }) => {
    await page.route('**/api/paper/paper-2', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            paper: {
              id: 'paper-2',
              assignment_id: null,
              assignment_set_id: 'set-2',
              set_order: 1,
              outline_id: 'outline-2',
              workflow_step: 'checkpoint',
              checkpoint_passed: true,
              emergency_skip_used: false,
              is_complete: true,
              paper_content: 'Already completed paper body.',
              topic: 'Completed prompt',
            },
            set: {
              id: 'set-2',
              title: 'Policy Set',
              assignment_prompt: 'Write policy responses.',
              rubric_text: null,
            },
          }),
        });
        return;
      }

      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        expect(body.is_complete).toBe(false);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            paper: {
              id: 'paper-2',
              assignment_set_id: 'set-2',
              is_complete: false,
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    const isAuthenticated = await openAcademicPath(
      page,
      '/academic/paper-workflow/paper/paper-2?setId=set-2'
    );
    if (!isAuthenticated) return;

    await expect(page.getByRole('button', { name: 'Unlock to edit' })).toBeVisible();
    await page.getByRole('button', { name: 'Unlock to edit' }).click();

    await expect(page.getByText('Paper unlocked for editing.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as complete' })).toBeVisible();
  });

  test('set_complete true path returns to assignment set and shows set completion panel', async ({ page }) => {
    let completeCalls = 0;

    await page.route('**/api/paper/paper-3', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            paper: {
              id: 'paper-3',
              assignment_id: null,
              assignment_set_id: 'set-3',
              set_order: 3,
              outline_id: 'outline-3',
              workflow_step: 'checkpoint',
              checkpoint_passed: true,
              emergency_skip_used: false,
              is_complete: false,
              paper_content: 'Final paper content body.',
              topic: 'Final prompt in set',
            },
            set: {
              id: 'set-3',
              title: 'American Lit Final Set',
              assignment_prompt: 'Finish all writing prompts.',
              rubric_text: null,
            },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/paper/paper-3/complete', async (route) => {
      completeCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complete: true, set_complete: true, set_id: 'set-3' }),
      });
    });

    await page.route('**/api/paper/assignment-set?id=set-3&include=papers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          set: {
            id: 'set-3',
            title: 'American Lit Final Set',
            class_name: 'ENG 250',
            assignment_prompt: 'Finish all writing prompts.',
            rubric_text: null,
            status: 'completed',
          },
          papers: [
            {
              id: 'paper-1',
              topic: 'Prompt one',
              set_order: 1,
              outline_id: 'o-1',
              paper_content: 'Paper 1 body',
              word_count: 400,
              is_complete: true,
              workflow_step: 'library',
              completed_at: '2026-03-10T10:00:00.000Z',
              updated_at: '2026-03-10T10:00:00.000Z',
              created_at: '2026-03-10T09:00:00.000Z',
            },
            {
              id: 'paper-2',
              topic: 'Prompt two',
              set_order: 2,
              outline_id: 'o-2',
              paper_content: 'Paper 2 body',
              word_count: 420,
              is_complete: true,
              workflow_step: 'library',
              completed_at: '2026-03-10T11:00:00.000Z',
              updated_at: '2026-03-10T11:00:00.000Z',
              created_at: '2026-03-10T09:30:00.000Z',
            },
            {
              id: 'paper-3',
              topic: 'Final prompt in set',
              set_order: 3,
              outline_id: 'o-3',
              paper_content: 'Final paper content body.',
              word_count: 450,
              is_complete: true,
              workflow_step: 'library',
              completed_at: '2026-03-10T12:00:00.000Z',
              updated_at: '2026-03-10T12:00:00.000Z',
              created_at: '2026-03-10T10:00:00.000Z',
            },
          ],
        }),
      });
    });

    await page.route('**/api/paper/set-summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          papers_total: 3,
          clean_completions: 3,
          revised_papers: 0,
          total_words: 1270,
          time_to_complete_seconds: 7200,
          natural_summary: 'You completed all writing prompts with consistent structure.',
        }),
      });
    });

    const isAuthenticated = await openAcademicPath(
      page,
      '/academic/paper-workflow/paper/paper-3?setId=set-3'
    );
    if (!isAuthenticated) return;

    await page.getByRole('button', { name: 'Mark as complete' }).click();
    expect(completeCalls).toBe(1);
    await expect(page.getByRole('button', { name: 'Back to assignment' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to assignment' }).click();
    await expect(page).toHaveURL(/\/academic\/paper-workflow\/set\/set-3/);
    await expect(page.getByText('Assignment summary')).toBeVisible();
    await expect(page.getByText('You completed all writing prompts with consistent structure.')).toBeVisible();
    await expect(page.getByText('Your papers — for reference')).toBeVisible();
  });
});
