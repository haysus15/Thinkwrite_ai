import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Paper step progression', () => {
  const LEGACY_PAPER_PATH = '/academic/paper-workflow?assignmentId=e2e-assignment';

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

  test('enforces locked transitions and checkpoint gating', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await expect(page.getByText('Paper workflow', { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/academic\/paper-workflow/);
    await expect(page.getByRole('button', { name: 'Outline' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Generate' }).first().click();
    await expect(page.getByText('Complete your outline first')).toBeVisible();
    await expect(page).toHaveURL(/\/academic\/paper-workflow/);

    await page.getByRole('button', { name: 'Checkpoint' }).first().click();
    await expect(page.getByText('Generate your paper first')).toBeVisible();
    await expect(page).toHaveURL(/\/academic\/paper-workflow/);

    await page.getByRole('button', { name: 'Library' }).first().click();
    await expect(page.getByText('Complete the Understanding Checkpoint first')).toBeVisible();
    await expect(page).toHaveURL(/\/academic\/paper-workflow/);

    await page.getByRole('button', { name: 'Outline' }).first().click();
    await expect(page.getByText('Complete your outline first')).not.toBeVisible();
  });

  test('exposes lock prerequisite copy in step aria labels', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await expect(
      page.getByRole('button', { name: /Generate\.\s*Complete your outline first/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /Checkpoint\.\s*Generate your paper first/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page
        .getByRole('button', {
          name: /Library\.\s*Complete the Understanding Checkpoint first/i,
        })
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('clears lock notice after timeout', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await page.getByRole('button', { name: 'Generate' }).first().click();
    await expect(page.getByText('Complete your outline first')).toBeVisible();
    await page.waitForTimeout(3600);
    await expect(page.getByText('Complete your outline first')).not.toBeVisible();
  });

  test('keeps declaration continue disabled until all three answers meet minimum length', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    const continueButton = page.getByRole('button', { name: 'Continue to outline' });
    await expect(continueButton).toBeDisabled();

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas.nth(2).fill('Short');
    await expect(continueButton).toBeDisabled();

    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');
    await expect(continueButton).toBeEnabled();
  });

  test('creates draft outline when declaration submits with no existing outline id', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    let createCalled = false;
    await page.route('**/api/academic/outline/create', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      createCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, outlineId: 'outline-e2e-1' }),
      });
    });

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');

    await page.getByRole('button', { name: 'Continue to outline' }).click();
    await expect
      .poll(() => createCalled, { timeout: 5000 })
      .toBeTruthy();
    await expect(page.getByText('Declaration saved. Continue building your outline.')).toBeVisible();
  });

  test('shows source requirement notice when declaration detects sources are required', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await page.route('**/api/academic/paper/source-requirements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sourceRequirements: {
            sourcesRequired: true,
            minimumCount: 2,
            sourceTypes: ['peer-reviewed'],
            citationFormat: 'APA',
            detected_from: 'requirements',
          },
        }),
      });
    });

    await page.route('**/api/academic/outline/create', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, outlineId: 'outline-e2e-source-1' }),
      });
    });

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');

    await page.getByRole('button', { name: 'Continue to outline' }).click();
    await expect(page.getByText('This paper requires sources')).toBeVisible();
    await expect(page.getByText('2 source(s) in APA', { exact: false })).toBeVisible();
  });

  test('blocks continue to generation when source requirements are not met', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await page.route('**/api/academic/paper/source-requirements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sourceRequirements: {
            sourcesRequired: true,
            minimumCount: 2,
            sourceTypes: ['peer-reviewed'],
            citationFormat: 'APA',
            detected_from: 'requirements',
          },
        }),
      });
    });

    await page.route('**/api/academic/outline/create', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, outlineId: 'outline-e2e-source-2' }),
      });
    });

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');

    await page.getByRole('button', { name: 'Continue to outline' }).click();

    // Rate each section so the only blocker is source completeness.
    await page.getByRole('button', { name: 'Solid' }).nth(0).click();
    await page.getByRole('button', { name: 'Solid' }).nth(1).click();
    await page.getByRole('button', { name: 'Solid' }).nth(2).click();

    await page.getByRole('button', { name: 'Continue to generation' }).click();
    await expect(page.getByText('Source check:', { exact: false })).toBeVisible();
    await expect(page.getByText('You need 2 sources', { exact: false })).toBeVisible();
  });

  test('persists source guidance event to outline conversation history', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await page.route('**/api/academic/paper/source-requirements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sourceRequirements: {
            sourcesRequired: true,
            minimumCount: 1,
            sourceTypes: ['peer-reviewed'],
            citationFormat: 'APA',
            detected_from: 'requirements',
          },
        }),
      });
    });

    await page.route('**/api/victor/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          conversationId: 'conv-e2e-source-guidance',
          reply:
            'Use peer-reviewed articles from Google Scholar and library databases, with terms tied to your section claim.',
          responseType: 'conversation',
        }),
      });
    });

    await page.route('**/api/academic/outline/create', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, outlineId: 'outline-e2e-source-history' }),
      });
    });

    let sourceGuidancePersisted = false;
    await page.route('**/api/academic/outline/*', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      const history = Array.isArray(body?.conversationHistory)
        ? body.conversationHistory
        : [];
      sourceGuidancePersisted = history.some(
        (item) => item?.type === 'source_guidance'
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');

    await page.getByRole('button', { name: 'Continue to outline' }).click();
    await page.getByRole('button', { name: 'Ask Victor what to look for' }).first().click();
    await expect
      .poll(() => sourceGuidancePersisted, { timeout: 5000 })
      .toBeTruthy();
  });

  test('blocks continue to generation when sections are not Victor-confirmed', async ({ page }) => {
    const isAuthenticated = await openAcademicPath(page, LEGACY_PAPER_PATH);
    if (!isAuthenticated) return;

    await page.route('**/api/academic/paper/source-requirements', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sourceRequirements: {
            sourcesRequired: false,
            minimumCount: null,
            sourceTypes: [],
            citationFormat: null,
            detected_from: 'none',
          },
        }),
      });
    });

    await page.route('**/api/academic/outline/create', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, outlineId: 'outline-e2e-confirmation-1' }),
      });
    });

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Main argument with enough detail to pass minimum.');
    await textareas.nth(1).fill('Main points with enough detail to pass minimum.');
    await textareas
      .nth(2)
      .fill('Assignment understanding with enough detail to pass minimum.');

    await page.getByRole('button', { name: 'Continue to outline' }).click();

    // Rate each section; do not run understanding checks.
    await page.getByRole('button', { name: 'Solid' }).nth(0).click();
    await page.getByRole('button', { name: 'Solid' }).nth(1).click();
    await page.getByRole('button', { name: 'Solid' }).nth(2).click();

    await page.getByRole('button', { name: 'Continue to generation' }).click();
    await expect(
      page.getByText('Victor still needs confirmation', { exact: false })
    ).toBeVisible();
  });
});
