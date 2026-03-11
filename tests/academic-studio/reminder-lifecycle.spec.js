import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Reminder evaluate/dismiss/non-resurface', () => {
  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function nextWeekStartKey() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const dayOffset = (7 - date.getDay()) % 7 || 7;
    date.setDate(date.getDate() + dayOffset);
    return toDateKey(date);
  }

  function tomorrowKey() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    return toDateKey(date);
  }

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

  test('does not duplicate or resurface dismissed reminder in same day', async ({ page }) => {
    let dismissed = false;
    let evaluateCount = 0;
    let activeCount = 0;
    let dismissCount = 0;
    const dismissPayloads = [];
    const reminderMessage = 'Essay 1 is due tomorrow. Let\'s make sure you\'re ready.';

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
              due_date: '2026-03-09',
              status: 'planned',
              is_at_risk: true,
              completed: false,
              tasks: [],
            },
          ],
        }),
      });
    });
    await page.route('**/api/travis/class-plans**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans: [] }),
      });
    });
    await page.route('**/api/travis/changes/since**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status_changes: [],
          completed_tasks: [],
          new_assignments: [],
        }),
      });
    });
    await page.route('**/api/travis/reminders/evaluate**', async (route) => {
      evaluateCount += 1;
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route('**/api/travis/reminders/active**', async (route) => {
      activeCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reminders: dismissed
            ? []
            : [
                {
                  id: 'rem-1',
                  assignmentId: 'asg-1',
                  reminderType: '1_day',
                  createdAt: '2026-03-08T08:00:00.000Z',
                  message: reminderMessage,
                },
              ],
        }),
      });
    });
    await page.route('**/api/travis/reminders/dismiss**', async (route) => {
      dismissed = true;
      dismissCount += 1;
      expect(route.request().method()).toBe('POST');
      dismissPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/agenda');
    if (!isAuthenticated) return;

    await expect(page.getByText(reminderMessage)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(page.getByText(reminderMessage)).not.toBeVisible();
    await expect(page.getByText('Travis reminders')).not.toBeVisible();
    await page.reload();
    await expect(page.getByText(reminderMessage)).not.toBeVisible();
    await expect(page.getByText('Travis reminders')).not.toBeVisible();

    expect(evaluateCount).toBeGreaterThan(0);
    expect(activeCount).toBeGreaterThan(0);
    expect(dismissCount).toBe(1);
    expect(dismissPayloads[0]).toEqual({
      assignmentId: 'asg-1',
      reminderType: '1_day',
    });
  });

  test('shows future-week contextual at-risk copy', async ({ page }) => {
    const reminderMessage = 'Essay 2 is due tomorrow. Let\'s make sure you\'re ready.';

    await page.route('**/api/travis/assignments/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [
            {
              id: 'asg-2',
              assignment_name: 'Essay 2',
              class_name: 'English 102',
              due_date: tomorrowKey(),
              status: 'planned',
              is_at_risk: true,
              completed: false,
              tasks: [],
            },
          ],
        }),
      });
    });
    await page.route('**/api/travis/class-plans**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans: [] }),
      });
    });
    await page.route('**/api/travis/changes/since**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status_changes: [],
          completed_tasks: [],
          new_assignments: [],
        }),
      });
    });
    await page.route('**/api/travis/reminders/evaluate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route('**/api/travis/reminders/active**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reminders: [
            {
              id: 'rem-2',
              assignmentId: 'asg-2',
              reminderType: '1_day',
              createdAt: '2026-03-08T08:00:00.000Z',
              message: reminderMessage,
            },
          ],
        }),
      });
    });
    await page.route('**/api/travis/reminders/dismiss**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    const isAuthenticated = await openAcademicPath(
      page,
      `/academic/agenda?weekStart=${nextWeekStartKey()}`
    );
    if (!isAuthenticated) return;

    await expect(
      page.getByText('Nothing at risk in the week you are viewing.', { exact: false })
    ).toBeVisible();
    await expect(page.getByText(reminderMessage)).toBeVisible();
  });

  test('hides reminder panel when there are no active reminders', async ({ page }) => {
    await page.route('**/api/travis/assignments/all**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assignments: [],
        }),
      });
    });
    await page.route('**/api/travis/class-plans**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans: [] }),
      });
    });
    await page.route('**/api/travis/changes/since**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status_changes: [],
          completed_tasks: [],
          new_assignments: [],
        }),
      });
    });
    await page.route('**/api/travis/reminders/evaluate**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route('**/api/travis/reminders/active**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reminders: [],
        }),
      });
    });
    await page.route('**/api/travis/reminders/dismiss**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/agenda');
    if (!isAuthenticated) return;

    await expect(page.getByText('Travis reminders')).not.toBeVisible();
  });
});
