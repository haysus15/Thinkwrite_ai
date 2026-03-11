import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Assignment task auto-seed and sync', () => {
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

  test('syncs task completion to assignment progress/status', async ({ page }) => {
    let status = 'inbox';
    let progress = 20;
    const updatePayloads = [];

    await page.route('**/api/travis/assignments/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'asg-1',
              assignment_name: 'Essay 1',
              class_name: 'English 101',
              due_date: '2026-03-20',
              status,
              priority: 'medium',
              completed: status === 'completed',
              syllabus_id: null,
              archived_at: null,
              progress_percent: progress,
              tasks: [
                { id: 'task-1', task_type: 'outline', status: status === 'completed' ? 'complete' : 'in_progress' },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/api/travis/assignment/update/**', async (route) => {
      expect(route.request().method()).toBe('PATCH');
      const body = route.request().postDataJSON();
      updatePayloads.push(body);
      if (body?.status) {
        status = body.status;
        progress = status === 'completed' ? 100 : 20;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, needs_plan_prompt: false }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/assignments');
    if (!isAuthenticated) return;

    await expect(page.getByText('Essay 1')).toBeVisible();
    await expect(page.getByText('20%')).toBeVisible();
    const statusSelect = page.locator('select').filter({ has: page.locator('option[value="completed"]') }).first();
    await expect(statusSelect).toHaveValue('inbox');
    await statusSelect.selectOption('completed');
    await expect(statusSelect).toHaveValue('completed');
    await expect(page.getByText('100%')).toBeVisible();

    expect(updatePayloads.length).toBe(1);
    expect(updatePayloads[0]?.status).toBe('completed');
  });

  test('keeps partial progress when status changes to in_progress', async ({ page }) => {
    let status = 'inbox';
    let progress = 20;
    const updatePayloads = [];

    await page.route('**/api/travis/assignments/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'asg-2',
              assignment_name: 'Lab Writeup',
              class_name: 'BIO 102',
              due_date: '2026-03-22',
              status,
              priority: 'medium',
              completed: false,
              syllabus_id: null,
              archived_at: null,
              progress_percent: progress,
              tasks: [
                { id: 'task-2', task_type: 'outline', status: 'in_progress' },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/api/travis/assignment/update/**', async (route) => {
      expect(route.request().method()).toBe('PATCH');
      const body = route.request().postDataJSON();
      updatePayloads.push(body);
      if (body?.status) {
        status = body.status;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, needs_plan_prompt: false }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/assignments');
    if (!isAuthenticated) return;

    await expect(page.getByText('Lab Writeup')).toBeVisible();
    await expect(page.getByText('20%')).toBeVisible();

    const statusSelect = page.locator('select').filter({ has: page.locator('option[value="in_progress"]') }).first();
    await statusSelect.selectOption('in_progress');
    await expect(statusSelect).toHaveValue('in_progress');
    await expect(page.getByText('20%')).toBeVisible();

    expect(updatePayloads.length).toBe(1);
    expect(updatePayloads[0]?.status).toBe('in_progress');
  });

  test('shows error when assignment status update fails', async ({ page }) => {
    await page.route('**/api/travis/assignments/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'asg-3',
              assignment_name: 'History Reflection',
              class_name: 'HIST 110',
              due_date: '2026-03-25',
              status: 'inbox',
              priority: 'medium',
              completed: false,
              syllabus_id: null,
              archived_at: null,
              progress_percent: 10,
              tasks: [],
            },
          ],
        }),
      });
    });

    await page.route('**/api/travis/assignment/update/**', async (route) => {
      expect(route.request().method()).toBe('PATCH');
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Update failed.' }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/assignments');
    if (!isAuthenticated) return;

    await expect(page.getByText('History Reflection')).toBeVisible();
    const statusSelect = page.locator('select').filter({ has: page.locator('option[value="completed"]') }).first();
    await statusSelect.selectOption('completed');
    await expect(page.getByText('Update failed.')).toBeVisible();
    await expect(statusSelect).toHaveValue('inbox');
  });
});
