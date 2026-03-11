import { test, expect } from 'playwright/test';

test.describe('Academic Studio: Study Hub upload/delete/undo', () => {
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

  test('reflects upload and supports undo delete window', async ({ page }) => {
    let materials = [
      {
        id: 'mat-1',
        title: 'Cell Biology Notes',
        class_name: 'BIO 101',
        topic: 'Cell structure',
      },
    ];
    let deleteCount = 0;
    const deletedMaterialIds = [];

    await page.route('**/api/study/materials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ materials }),
      });
    });
    await page.route('**/api/quiz/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quizzes: [], attempts: [] }),
      });
    });
    await page.route('**/api/study/materials/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const id = route.request().url().split('/').pop();
        deletedMaterialIds.push(id);
        materials = materials.filter((row) => row.id !== id);
        deleteCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      await route.fallback();
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/study-hub?tab=library');
    if (!isAuthenticated) return;

    await expect(page.getByText('Cell Biology Notes')).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete pending...' })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(deleteCount).toBe(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Undo' })).not.toBeVisible();
    await page.waitForTimeout(5500);
    await expect(page.getByText('Cell Biology Notes')).toBeVisible();
    expect(deleteCount).toBe(0);

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForTimeout(5500);
    await expect(page.getByText('Cell Biology Notes')).not.toBeVisible();
    expect(deleteCount).toBe(1);
    expect(deletedMaterialIds).toEqual(['mat-1']);
  });

  test('supports quiz-history delete undo window', async ({ page }) => {
    let quizzes = [
      {
        id: 'quiz-1',
        title: 'Cell Biology Quiz',
      },
    ];
    let attempts = [
      {
        id: 'attempt-1',
        quiz_id: 'quiz-1',
        score: 80,
        correct_count: 8,
        total_questions: 10,
      },
    ];
    let quizDeleteCount = 0;
    const deletedQuizIds = [];

    await page.route('**/api/study/materials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ materials: [] }),
      });
    });
    await page.route('**/api/quiz/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quizzes, attempts }),
      });
    });
    await page.route('**/api/quiz/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const id = route.request().url().split('/').pop();
        deletedQuizIds.push(id);
        quizzes = quizzes.filter((quiz) => quiz.id !== id);
        attempts = attempts.filter((attempt) => attempt.quiz_id !== id);
        quizDeleteCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
        return;
      }
      await route.fallback();
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/study-hub?tab=quiz-history');
    if (!isAuthenticated) return;

    await expect(page.getByText('Cell Biology Quiz')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(5500);
    await expect(page.getByText('Cell Biology Quiz')).toBeVisible();
    expect(quizDeleteCount).toBe(0);

    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForTimeout(5500);
    await expect(page.getByText('Cell Biology Quiz')).not.toBeVisible();
    expect(quizDeleteCount).toBe(1);
    expect(deletedQuizIds).toEqual(['quiz-1']);
  });

  test('keeps quiz visible and shows error when delete fails', async ({ page }) => {
    let quizzes = [
      {
        id: 'quiz-2',
        title: 'Chemistry Quiz',
      },
    ];
    const attempts = [
      {
        id: 'attempt-2',
        quiz_id: 'quiz-2',
        score: 70,
        correct_count: 7,
        total_questions: 10,
      },
    ];

    await page.route('**/api/study/materials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ materials: [] }),
      });
    });
    await page.route('**/api/quiz/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quizzes, attempts }),
      });
    });
    await page.route('**/api/quiz/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        expect(route.request().url()).toContain('/api/quiz/quiz-2');
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Delete failed.' }),
        });
        return;
      }
      await route.fallback();
    });

    const isAuthenticated = await openAcademicPath(page, '/academic/study-hub?tab=quiz-history');
    if (!isAuthenticated) return;

    await expect(page.getByText('Chemistry Quiz')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.waitForTimeout(5500);
    await expect(page.getByText('Delete failed.')).toBeVisible();
    await expect(page.getByText('Chemistry Quiz')).toBeVisible();
  });
});
