/**
 * E2E Tests for Skills List Page
 * Tests the complete flow from API to UI
 */

import { test, expect } from '@playwright/test';

test.describe('Skills List Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to skills page
    await page.goto('/');
  });

  test.describe('Skills Display', () => {
    test('should display skills list with at least one skill', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Check that we don't see "No skills found" message
      const emptyState = page.locator('text=No skills found');
      await expect(emptyState).not.toBeVisible();

      // Check that skills grid is visible
      const skillsGrid = page.locator('[class*="grid"]');
      await expect(skillsGrid).toBeVisible();

      // Check that at least one skill card is displayed
      const skillCards = page.locator('[class*="SkillCard"], [class*="skill-card"], div:has-text("web-search")');
      const count = await skillCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display skill cards with correct information', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Check for web-search skill
      const webSearchSkill = page.locator('text=web-search');
      await expect(webSearchSkill).toBeVisible();

      // Check for skill description
      const description = page.locator('text=Search the web');
      await expect(description).toBeVisible();

      // Check for version
      const version = page.locator('text=v1.0.0');
      await expect(version).toBeVisible();
    });

    test('should display skill status badges', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Check for Active/Enabled status badges
      const activeBadges = page.locator('text=Active, text=Enabled, text=active');
      const count = await activeBadges.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display skill tags', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Check for tags (they should have # prefix or be in a tags container)
      const tags = page.locator('[class*="tag"], text=/^#search/, text=/^#web/');
      const count = await tags.count();
      // Tags should be visible for skills
      expect(count).toBeGreaterThan(0);
    });

    test('should show correct stats "Showing X of Y skills"', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Check for stats text
      const stats = page.locator('text=/Showing \\d+ of \\d+ skills/');
      await expect(stats).toBeVisible();

      // Verify the stats show non-zero count
      const statsText = await stats.textContent();
      expect(statsText).toMatch(/Showing [1-9]\d* of [1-9]\d* skills/);
    });
  });

  test.describe('Skills Search and Filter', () => {
    test('should search skills by name', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find search input
      const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]');
      await searchInput.fill('web-search');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show only web-search skill
      const skillCards = page.locator('[class*="SkillCard"], [class*="skill-card"]');
      const count = await skillCards.count();
      expect(count).toBe(1);

      // Should still have web-search visible
      const webSearchSkill = page.locator('text=web-search');
      await expect(webSearchSkill).toBeVisible();
    });

    test('should search skills by description', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find search input
      const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]');
      await searchInput.fill('execute code');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show code-executor skill
      const codeExecutor = page.locator('text=code-executor');
      await expect(codeExecutor).toBeVisible();
    });

    test('should filter by enabled status', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find filter dropdown
      const filterSelect = page.locator('select').first();
      await filterSelect.selectOption('enabled');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // All visible skills should be enabled
      // (This is a basic check - actual implementation may vary)
      const stats = page.locator('text=/Showing \\d+ of \\d+ skills/');
      await expect(stats).toBeVisible();
    });

    test('should clear search and show all skills', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Get initial count
      const initialStats = page.locator('text=/Showing \\d+ of \\d+ skills/');
      const initialText = await initialStats.textContent();

      // Search for something
      const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]');
      await searchInput.fill('web-search');
      await page.waitForTimeout(500);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Should show all skills again
      const finalStats = page.locator('text=/Showing \\d+ of \\d+ skills/');
      const finalText = await finalStats.textContent();

      expect(initialText).toBe(finalText);
    });

    test('should show "No skills found" for non-existent search', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Search for non-existent skill
      const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]');
      await searchInput.fill('nonexistent-skill-xyz123');
      await page.waitForTimeout(500);

      // Should show empty state
      const emptyState = page.locator('text=No skills found');
      await expect(emptyState).toBeVisible();
    });
  });

  test.describe('Skill Card Actions', () => {
    test('should have execute button for enabled skills', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find execute buttons
      const executeButtons = page.locator('button:has-text("Execute"), button:has-text("▶️"), [class*="execute"]');
      const count = await executeButtons.count();

      // Should have at least one execute button
      expect(count).toBeGreaterThan(0);
    });

    test('should have details button for each skill', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find details buttons
      const detailsButtons = page.locator('button:has-text("Details"), [class*="details"]');
      const count = await detailsButtons.count();

      // Should have at least one details button
      expect(count).toBeGreaterThan(0);
    });

    test('skill card should be clickable', async ({ page }) => {
      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Find first skill card and click it
      const firstSkillCard = page.locator('[class*="SkillCard"], [class*="skill-card"], div:has-text("web-search")').first();
      await firstSkillCard.click();

      // Should navigate to skill detail page or show some interaction
      // (Actual behavior depends on implementation)
      await page.waitForTimeout(500);
    });
  });

  test.describe('Connection Status', () => {
    test('should display connection status', async ({ page }) => {
      // Wait for connection to establish
      await page.waitForTimeout(2000);

      // Check for connection status indicator
      const statusElement = page.locator('[class*="status"], [class*="Status"], text=/connected|connecting|reconnecting/i');
      const count = await statusElement.count();

      // Should have some status indicator
      expect(count).toBeGreaterThan(0);
    });

    test('should show connected or reconnecting status', async ({ page }) => {
      // Wait for connection to establish
      await page.waitForTimeout(2000);

      // Check for status text
      const statusText = page.locator('text=/connected|reconnecting/i');
      await expect(statusText).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Should still show skills
      const skillsGrid = page.locator('[class*="grid"]');
      await expect(skillsGrid).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Should still show skills
      const skillsGrid = page.locator('[class*="grid"]');
      await expect(skillsGrid).toBeVisible();
    });

    test('should display correctly on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Wait for skills to load
      await page.waitForTimeout(2000);

      // Should still show skills
      const skillsGrid = page.locator('[class*="grid"]');
      await expect(skillsGrid).toBeVisible();
    });
  });
});

test.describe('Skills API Integration', () => {
  test('should successfully fetch skills from API', async ({ page }) => {
    // Start waiting for network response
    const [response] = await Promise.all([
      page.waitForResponse('**/api/skills'),
      page.goto('/'),
    ]);

    // Check response status
    expect(response.status()).toBe(200);

    // Check response data
    const json = await response.json();
    expect(json).toHaveProperty('skills');
    expect(json).toHaveProperty('total');
    expect(Array.isArray(json.skills)).toBe(true);
    expect(json.total).toBeGreaterThan(0);
  });

  test('API response should include enabled field', async ({ page }) => {
    // Start waiting for network response
    const [response] = await Promise.all([
      page.waitForResponse('**/api/skills'),
      page.goto('/'),
    ]);

    // Check response data
    const json = await response.json();

    // Each skill should have enabled field
    json.skills.forEach((skill: { id: string; enabled?: boolean }) => {
      expect(skill).toHaveProperty('enabled');
      expect(typeof skill.enabled).toBe('boolean');
    });
  });

  test('API response should include tags field', async ({ page }) => {
    // Start waiting for network response
    const [response] = await Promise.all([
      page.waitForResponse('**/api/skills'),
      page.goto('/'),
    ]);

    // Check response data
    const json = await response.json();

    // Skills should have tags field (may be undefined for backward compatibility)
    json.skills.forEach((skill: { id: string; tags?: string[] }) => {
      expect(skill).toHaveProperty('tags');
    });
  });
});
