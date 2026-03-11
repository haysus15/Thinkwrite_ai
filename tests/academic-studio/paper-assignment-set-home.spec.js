import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Paper assignment-set home flow', () => {
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

  test('renders assignment-set home with active/completed sections and progress counts', async ({ page }) => {
    const sets = [
      {
        id: 'set-active-1',
        title: 'Rhetorical Analysis Pack',
        class_name: 'ENG 201',
        assignment_prompt: 'Analyze two speeches.',
        rubric_text: null,
        paper_count: 3,
        source_type: 'manual',
        status: 'in_progress',
        completed_at: null,
        created_at: '2026-03-10T10:00:00.000Z',
        updated_at: '2026-03-10T12:30:00.000Z',
      },
      {
        id: 'set-complete-1',
        title: 'Weekly Reflection Set',
        class_name: 'HIST 210',
        assignment_prompt: null,
        rubric_text: null,
        paper_count: 2,
        source_type: 'paste',
        status: 'completed',
        completed_at: '2026-03-09T15:00:00.000Z',
        created_at: '2026-03-08T10:00:00.000Z',
        updated_at: '2026-03-09T15:00:00.000Z',
      },
    ];

    const papers = [
      { id: 'p-1', assignment_set_id: 'set-active-1', is_complete: true },
      { id: 'p-2', assignment_set_id: 'set-active-1', is_complete: false },
      { id: 'p-3', assignment_set_id: 'set-active-1', is_complete: false },
      { id: 'p-4', assignment_set_id: 'set-complete-1', is_complete: true },
      { id: 'p-5', assignment_set_id: 'set-complete-1', is_complete: true },
    ];

    await page.route('**/api/paper/assignment-set**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sets }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route('**/api/academic/papers/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, papers }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/paper-workflow');
    if (!isAuthenticated) return;

    await expect(page.getByText('Paper Workflow')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New paper' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New assignment set' })).toBeVisible();

    await expect(page.getByText('Rhetorical Analysis Pack')).toBeVisible();
    await expect(page.getByText('1 of 3 complete')).toBeVisible();

    await page.getByRole('button', { name: /Completed sets/i }).click();
    await expect(page.getByText('Weekly Reflection Set')).toBeVisible();
  });

  test('creates assignment set via manual entry and lands on set view', async ({ page }) => {
    let sets = [];
    let includePapersHits = 0;

    await page.route('**/api/paper/assignment-set**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET') {
        if (url.includes('include=papers')) {
          includePapersHits += 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              set: {
                id: 'set-new-1',
                title: 'Compare and Contrast Set',
                class_name: 'ENG 102',
                assignment_prompt: 'Write comparisons.',
                rubric_text: null,
                status: 'in_progress',
              },
              papers: [
                {
                  id: 'paper-new-1',
                  topic: 'Compare source A and B',
                  set_order: 1,
                  outline_id: null,
                  paper_content: '',
                  word_count: null,
                  is_complete: false,
                  workflow_step: 'outline',
                },
              ],
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sets }),
        });
        return;
      }

      if (method === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.title).toBe('Compare and Contrast Set');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            set: {
              id: 'set-new-1',
              title: body.title,
              class_name: body.class_name || null,
              assignment_prompt: body.assignment_prompt || null,
              rubric_text: body.rubric_text || null,
              paper_count: null,
              source_type: body.source_type || 'manual',
              status: 'in_progress',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      await route.fallback();
    });

    await page.route('**/api/academic/papers/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, papers: [] }),
      });
    });

    await page.route('**/api/paper/assignment/confirm', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.assignment_set_id).toBe('set-new-1');
      expect(Array.isArray(body.prompts)).toBe(true);
      expect(body.prompts.length).toBe(1);

      sets = [
        {
          id: 'set-new-1',
          title: 'Compare and Contrast Set',
          class_name: 'ENG 102',
          assignment_prompt: 'Write comparisons.',
          rubric_text: null,
          paper_count: 1,
          source_type: 'manual',
          status: 'in_progress',
          completed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: 1, paper_ids: ['paper-new-1'] }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/paper-workflow');
    if (!isAuthenticated) return;

    await page.getByRole('button', { name: 'New assignment set' }).click();
    await page.getByPlaceholder('Assignment title').fill('Compare and Contrast Set');
    await page.getByPlaceholder('Class / course name (optional)').fill('ENG 102');
    await page.getByPlaceholder('Assignment prompt (optional)').fill('Write comparisons.');

    await page.getByRole('button', { name: 'Enter manually' }).click();
    await page.getByPlaceholder('Prompt 1').fill('Compare source A and B');
    await page.getByRole('button', { name: 'Start writing' }).click();

    await expect(page).toHaveURL(/\/academic\/paper-workflow\/set\/set-new-1/);
    await expect(page.getByText('Compare and Contrast Set')).toBeVisible();
    await expect(page.getByText('0 of 1 papers complete')).toBeVisible();
    expect(includePapersHits).toBeGreaterThan(0);
  });
});
