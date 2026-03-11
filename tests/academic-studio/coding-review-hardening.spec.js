import { test, expect } from 'playwright/test';

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
    return false;
  }
  return true;
}

function wireCodingPathRoutes(page, { placementRequired = false, placementStartFails = false } = {}) {
  const pathId = 'js_essentials';
  let placementStartCalls = 0;

  page.route('**/api/academic/coding-review/paths**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith(`/paths/${pathId}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          path: {
            id: pathId,
            title: 'JS Essentials',
            language: 'javascript',
            description: 'JS core path',
            lesson_count: 1,
            created_at: new Date().toISOString(),
          },
          lessons: [
            {
              id: 'lesson-1',
              path_id: pathId,
              lesson_index: 0,
              title: 'Variables and Logging',
              concept_summary: 'Use const and console.log correctly.',
              challenge_prompt: 'Print your name and age using JavaScript.',
              required_skills: [],
              created_at: new Date().toISOString(),
            },
          ],
          progress: {
            id: 'progress-1',
            user_id: 'user-1',
            path_id: pathId,
            current_lesson: 0,
            lessons_completed: [],
            placement_level: null,
            placement_data: null,
            checkpoint_results: [],
            total_time_seconds: 0,
            struggle_topics: [],
            started_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            completed_at: null,
          },
        }),
      });
      return;
    }

    if (pathname.endsWith('/paths')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          paths: [
            {
              id: pathId,
              title: 'JS Essentials',
              language: 'javascript',
              description: 'JS core path',
              lesson_count: 1,
              created_at: new Date().toISOString(),
              progress: null,
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  page.route('**/api/academic/coding-review/placement/start', async (route) => {
    placementStartCalls += 1;
    if (placementStartFails) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Could not start path.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        placement: {},
        challenges: placementRequired ? ['Write a function that returns the larger number.'] : [],
        placementRequired,
        nextChallengeIndex: 0,
      }),
    });
  });

  return {
    getPlacementStartCalls: () => placementStartCalls,
    pathId,
  };
}

test.describe('Academic Studio: Coding Review hardening', () => {
  test('generates JavaScript starter with // comments', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, '/academic/coding-review');
    if (!isAuthenticated) return;

    wireCodingPathRoutes(page, { placementRequired: false });

    await page.locator('select').first().selectOption('javascript');
    await page.getByRole('button', { name: 'Turn on Learning Coach' }).click();
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.getByRole('button', { name: 'Load lesson' }).click();

    const editorContent = page.locator('.cm-content').first();
    await expect(editorContent).toContainText('// Lesson: Variables and Logging');
    await expect(editorContent).not.toContainText('# Lesson:');
  });

  test('blocks placement submit until run, and shows inline error if output is cleared', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, '/academic/coding-review');
    if (!isAuthenticated) return;

    wireCodingPathRoutes(page, { placementRequired: true });

    await page.getByRole('button', { name: 'Turn on Learning Coach' }).click();
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    const submitAttempt = page.getByRole('button', { name: 'Submit attempt' });
    await expect(submitAttempt).toBeDisabled();
    await expect(page.getByText('Run your code before submitting.')).toBeVisible();

    await page.getByRole('button', { name: 'Run' }).first().click();
    await expect(page.getByRole('button', { name: 'Run' }).first()).toBeEnabled({ timeout: 20000 });
    await page.getByRole('button', { name: 'Clear' }).first().click();

    await expect(submitAttempt).toBeEnabled();
    await submitAttempt.click();
    await expect(
      page.getByText('Run your code first. Placement cannot be evaluated without execution output.')
    ).toBeVisible();
  });

  test('creates assignment session using resolved assignment language', async ({ page }) => {
    let createdLanguage = null;

    await page.route('**/api/travis/assignment/asg-sql', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          assignment: {
            id: 'asg-sql',
            assignment_name: 'SQL lab',
            language: 'sql',
            requirements: null,
          },
        }),
      });
    });

    await page.route('**/api/academic/coding-review/session/create', async (route) => {
      const body = route.request().postDataJSON();
      createdLanguage = body?.language || null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session: {
            id: 'session-1',
            user_id: 'user-1',
            language: createdLanguage,
            entry_type: 'assignment',
            path_id: null,
            assignment_id: 'asg-sql',
            code_snapshot: null,
            output_snapshot: null,
            victor_context: null,
            started_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            completed_at: null,
          },
        }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/coding-review?assignmentId=asg-sql');
    if (!isAuthenticated) return;

    await expect
      .poll(() => createdLanguage, { timeout: 5000 })
      .toBe('sql');
  });

  test('keeps path modal open and shows retryable error when start fails', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, '/academic/coding-review');
    if (!isAuthenticated) return;

    const routes = wireCodingPathRoutes(page, { placementStartFails: true });

    await page.getByRole('button', { name: 'Turn on Learning Coach' }).click();
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('Could not start path.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText('Learning Coach means Victor runs a quick placement')).toBeVisible();

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect
      .poll(() => routes.getPlacementStartCalls(), { timeout: 5000 })
      .toBeGreaterThan(1);
    await expect(page.getByText('Could not start path.')).toBeVisible();
  });
});
