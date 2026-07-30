import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';

const ITERATIONS = Number(process.env.PLAYWRIGHT_ITERATIONS ?? 100);
const GAME_STORAGE_KEY = 'kniffel-extreme-game';
const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:8080';
const MATRIX_PLAYER_COUNT = 10;

interface EditableScoreField {
  section: 'upper' | 'lower';
  field: string;
  inputRowIndex: number;
}

interface InputValueWrite {
  before: string;
  after: string;
  index: number;
  focused: boolean;
  timestamp: number;
}

const EDITABLE_SCORE_FIELDS: EditableScoreField[] = [
  { section: 'lower', field: 'threeOfKind', inputRowIndex: 6 },
  { section: 'lower', field: 'fourOfKind', inputRowIndex: 7 },
  { section: 'lower', field: 'twoPairs', inputRowIndex: 8 },
  { section: 'lower', field: 'chance', inputRowIndex: 9 },
  { section: 'lower', field: 'superChance', inputRowIndex: 10 },
  { section: 'upper', field: 'ones', inputRowIndex: 0 },
  { section: 'upper', field: 'twos', inputRowIndex: 1 },
  { section: 'upper', field: 'threes', inputRowIndex: 2 },
  { section: 'upper', field: 'fours', inputRowIndex: 3 },
  { section: 'upper', field: 'fives', inputRowIndex: 4 },
  { section: 'upper', field: 'sixes', inputRowIndex: 5 },
];

const waitForConnected = async (page: Page): Promise<void> => {
  await page.locator('header button').first().click();
  await expect(
    page.getByText('Mit dem Raum verbunden.', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
};

const readStoredScore = async (
  page: Page,
  playerIndex = 0,
  section: 'upper' | 'lower' = 'upper',
  field = 'ones',
): Promise<number | null> =>
  page.evaluate(
    ({ storageKey, playerIndex, section, field }) => {
      const rawState = localStorage.getItem(storageKey);
      if (!rawState) return null;
      return JSON.parse(rawState).players[playerIndex][section][field].value as
        number | null;
    },
    { storageKey: GAME_STORAGE_KEY, playerIndex, section, field },
  );

const openClient = async (
  browser: Browser,
  roomId: string,
  contextOptions: BrowserContextOptions,
  instrumentValueSetter = false,
): Promise<{ context: BrowserContext; page: Page }> => {
  const context = await browser.newContext(contextOptions);
  if (instrumentValueSetter) {
    await context.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      );
      if (!descriptor?.get || !descriptor.set) return;

      const writes: InputValueWrite[] = [];
      Object.defineProperty(window, '__scoreInputValueWrites', {
        value: writes,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(HTMLInputElement.prototype, 'value', {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(nextValue: string) {
          const before = descriptor.get?.call(this) ?? '';
          descriptor.set?.call(this, nextValue);
          if (this.inputMode !== 'numeric') return;

          const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>(
              'input[inputmode="numeric"]',
            ),
          );
          writes.push({
            before,
            after: descriptor.get?.call(this) ?? '',
            index: inputs.indexOf(this),
            focused: document.activeElement === this,
            timestamp: performance.now(),
          });
        },
      });
    });
  }
  const page = await context.newPage();
  await page.goto(`${APP_URL}/?room=${encodeURIComponent(roomId)}`);
  await waitForConnected(page);
  return { context, page };
};

const readInputValueWrites = async (page: Page): Promise<InputValueWrite[]> =>
  page.evaluate(() => {
    const instrumentedWindow = window as Window & {
      __scoreInputValueWrites?: InputValueWrite[];
    };
    return instrumentedWindow.__scoreInputValueWrites ?? [];
  });

test('remote score values remain painted while unfocused over 100 updates', async ({
  browser,
}, testInfo) => {
  const roomId = `playwright-score-render-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions);

  try {
    const senderInput = sender.page
      .locator('input[inputmode="numeric"]')
      .first();
    const receiverInput = receiver.page
      .locator('input[inputmode="numeric"]')
      .first();
    const receiverUpperTotal = receiver.page
      .getByText('Gesamt', { exact: true })
      .first()
      .locator('..')
      .locator(':scope > div')
      .nth(1);

    await expect(senderInput).toBeVisible();
    await expect(receiverInput).toBeVisible();
    await expect(receiverInput).not.toBeFocused();

    const inputBox = await receiverInput.boundingBox();
    expect(inputBox).not.toBeNull();
    if (!inputBox) throw new Error('Receiver score input has no bounding box.');

    const blankPixels = await receiver.page.screenshot({ clip: inputBox });
    let previousPixels = blankPixels;
    const stalePaintIterations: number[] = [];
    const blankPaintIterations: number[] = [];

    for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
      const value = iteration % 2 === 0 ? 88 : 11;
      await senderInput.fill(String(value));

      await expect
        .poll(() => readStoredScore(receiver.page), {
          message: `receiver storage did not contain ${value} at iteration ${iteration}`,
        })
        .toBe(value);

      await expect(receiverUpperTotal).toHaveText(String(value));
      await expect(receiverInput).not.toBeFocused();
      await expect(receiverInput).toHaveValue(String(value));

      const currentPixels = await receiver.page.screenshot({ clip: inputBox });
      if (currentPixels.equals(previousPixels))
        stalePaintIterations.push(iteration);
      if (currentPixels.equals(blankPixels))
        blankPaintIterations.push(iteration);
      previousPixels = currentPixels;
    }

    expect(
      {
        stalePaintIterations,
        blankPaintIterations,
      },
      'Remote values remained visually blank until the receiver input was focused.',
    ).toEqual({
      stalePaintIterations: [],
      blankPaintIterations: [],
    });
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('remote score remains painted after a 100-update burst', async ({
  browser,
}, testInfo) => {
  const roomId = `playwright-score-burst-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions);

  try {
    const senderInput = sender.page
      .locator('input[inputmode="numeric"]')
      .first();
    const receiverInput = receiver.page
      .locator('input[inputmode="numeric"]')
      .first();
    const inputBox = await receiverInput.boundingBox();
    expect(inputBox).not.toBeNull();
    if (!inputBox) throw new Error('Receiver score input has no bounding box.');

    const blankPixels = await receiver.page.screenshot({ clip: inputBox });

    for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
      const value =
        iteration === ITERATIONS ? 77 : iteration % 2 === 0 ? 88 : 11;
      await senderInput.fill(String(value));
    }

    await expect
      .poll(() => readStoredScore(receiver.page), {
        message: 'receiver storage did not contain the final burst value',
      })
      .toBe(77);
    await expect(receiverInput).not.toBeFocused();
    await expect(receiverInput).toHaveValue('77');

    const finalPixels = await receiver.page.screenshot({ clip: inputBox });
    expect(
      finalPixels.equals(blankPixels),
      'The final remote value reached the DOM but remained visually blank after the burst.',
    ).toBe(false);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('remote score remains painted beside a sticky column while horizontally scrolled', async ({
  browser,
}, testInfo) => {
  const roomId = `playwright-score-sticky-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions);

  try {
    const addPlayerButton = sender.page.getByRole('button', {
      name: 'Spieler hinzufügen',
    });
    for (let playerIndex = 1; playerIndex < 4; playerIndex += 1) {
      await addPlayerButton.click();
    }
    await expect(
      receiver.page.getByText('Spieler 4', { exact: true }),
    ).toBeVisible();

    const senderInput = sender.page
      .locator('input[inputmode="numeric"]')
      .nth(39);
    const receiverInput = receiver.page
      .locator('input[inputmode="numeric"]')
      .nth(39);
    await receiverInput.scrollIntoViewIfNeeded();
    await receiver.page.evaluate(() =>
      window.scrollTo(document.documentElement.scrollWidth, window.scrollY),
    );
    await expect(receiverInput).toBeVisible();
    await expect(receiverInput).not.toBeFocused();

    const inputBox = await receiverInput.boundingBox();
    expect(inputBox).not.toBeNull();
    if (!inputBox)
      throw new Error('Scrolled receiver score input has no bounding box.');

    const blankPixels = await receiver.page.screenshot({ clip: inputBox });
    let previousPixels = blankPixels;
    const stalePaintIterations: number[] = [];
    const blankPaintIterations: number[] = [];

    for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
      const value = iteration % 2 === 0 ? 88 : 11;
      await senderInput.fill(String(value));

      await expect
        .poll(() => readStoredScore(receiver.page, 3, 'lower', 'chance'), {
          message: `scrolled receiver storage did not contain ${value} at iteration ${iteration}`,
        })
        .toBe(value);
      await expect(receiverInput).not.toBeFocused();
      await expect(receiverInput).toHaveValue(String(value));

      const currentPixels = await receiver.page.screenshot({ clip: inputBox });
      if (currentPixels.equals(previousPixels))
        stalePaintIterations.push(iteration);
      if (currentPixels.equals(blankPixels))
        blankPaintIterations.push(iteration);
      previousPixels = currentPixels;
    }

    expect(
      { stalePaintIterations, blankPaintIterations },
      'Remote values remained visually blank beside the sticky column.',
    ).toEqual({ stalePaintIterations: [], blankPaintIterations: [] });
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('distinct empty score inputs paint their first remote value', async ({
  browser,
}, testInfo) => {
  const roomId = `playwright-empty-score-matrix-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions);

  try {
    const addPlayerButton = sender.page.getByRole('button', {
      name: 'Spieler hinzufügen',
    });
    for (let playerIndex = 1; playerIndex < MATRIX_PLAYER_COUNT; playerIndex += 1) {
      await addPlayerButton.click();
    }
    await expect(
      receiver.page.getByText(`Spieler ${MATRIX_PLAYER_COUNT}`, { exact: true }),
    ).toBeVisible();

    const senderInputs = sender.page.locator('input[inputmode="numeric"]');
    const receiverInputs = receiver.page.locator('input[inputmode="numeric"]');
    await expect(receiverInputs).toHaveCount(
      MATRIX_PLAYER_COUNT * EDITABLE_SCORE_FIELDS.length,
    );

    const totals = {
      upper: Array<number>(MATRIX_PLAYER_COUNT).fill(0),
      lower: Array<number>(MATRIX_PLAYER_COUNT).fill(0),
    };
    const blankInputs: string[] = [];

    for (const [fieldIndex, target] of EDITABLE_SCORE_FIELDS.entries()) {
      const totalLabel = target.section === 'upper' ? 'Gesamt' : 'Gesamt unterer Teil';
      const totalRow = receiver.page
        .getByText(totalLabel, { exact: true })
        .first()
        .locator('..');

      for (let playerIndex = 0; playerIndex < MATRIX_PLAYER_COUNT; playerIndex += 1) {
        const inputIndex = target.inputRowIndex * MATRIX_PLAYER_COUNT + playerIndex;
        const senderInput = senderInputs.nth(inputIndex);
        const receiverInput = receiverInputs.nth(inputIndex);
        const targetName = `${target.section}.${target.field}[${playerIndex}]`;
        const value = 10 + ((fieldIndex * MATRIX_PLAYER_COUNT + playerIndex) % 90);

        await receiverInput.scrollIntoViewIfNeeded();
        await expect(receiverInput).toBeVisible();
        await expect(receiverInput).not.toBeFocused();
        await expect(receiverInput).toHaveValue('');

        const inputBox = await receiverInput.boundingBox();
        expect(inputBox, `${targetName} has no bounding box`).not.toBeNull();
        if (!inputBox) throw new Error(`${targetName} has no bounding box.`);
        const blankPixels = await receiver.page.screenshot({ clip: inputBox });

        await senderInput.fill(String(value));
        await expect
          .poll(
            () =>
              readStoredScore(
                receiver.page,
                playerIndex,
                target.section,
                target.field,
              ),
            {
              message: `${targetName} did not reach receiver storage`,
            },
          )
          .toBe(value);

        totals[target.section][playerIndex] +=
          target.field === 'superChance' ? value * 2 : value;
        await expect(totalRow.locator(':scope > div').nth(playerIndex + 1)).toHaveText(
          String(totals[target.section][playerIndex]),
        );
        await expect(receiverInput).not.toBeFocused();
        await expect(receiverInput).toHaveValue(String(value));

        const valuePixels = await receiver.page.screenshot({ clip: inputBox });
        if (valuePixels.equals(blankPixels)) blankInputs.push(targetName);
      }
    }

    expect(
      blankInputs,
      `First remote values remained visually blank in: ${blankInputs.join(', ')}`,
    ).toEqual([]);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('offscreen lower inputs paint while another input is focused', async ({
  browser,
}, testInfo) => {
  const playerCount = 4;
  const roomId = `playwright-offscreen-focused-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions, true);

  try {
    const addPlayerButton = sender.page.getByRole('button', {
      name: 'Spieler hinzufügen',
    });
    for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
      await addPlayerButton.click();
    }

    const senderInputs = sender.page.locator('input[inputmode="numeric"]');
    const receiverInputs = receiver.page.locator('input[inputmode="numeric"]');
    await expect(receiverInputs).toHaveCount(
      playerCount * EDITABLE_SCORE_FIELDS.length,
    );

    const receiverFocusInput = receiverInputs.first();
    const lowerFields = EDITABLE_SCORE_FIELDS.filter(
      (target) => target.section === 'lower',
    );
    const blankTargets: Array<{
      targetName: string;
      remainedBlankAfterScroll: boolean;
      remainedBlankAfterUnrelatedEdit: boolean;
      appearedOnFocus: boolean;
      persistedAfterBlur: boolean;
      writes: InputValueWrite[];
    }> = [];
    const expectedWrites: Array<{
      index: number;
      value: string;
      targetName: string;
    }> = [];

    for (const [fieldIndex, target] of lowerFields.entries()) {
      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        const inputIndex = target.inputRowIndex * playerCount + playerIndex;
        const senderInput = senderInputs.nth(inputIndex);
        const receiverInput = receiverInputs.nth(inputIndex);
        const targetName = `${target.field}[${playerIndex}]`;
        const value = 20 + fieldIndex * playerCount + playerIndex;
        expectedWrites.push({
          index: inputIndex,
          value: String(value),
          targetName,
        });

        await receiverInput.scrollIntoViewIfNeeded();
        const baselineBox = await receiverInput.boundingBox();
        expect(baselineBox, `${targetName} has no baseline box`).not.toBeNull();
        if (!baselineBox) throw new Error(`${targetName} has no baseline box.`);
        const baselineContentBox = {
          x: baselineBox.x + 8,
          y: baselineBox.y + 4,
          width: baselineBox.width - 16,
          height: baselineBox.height - 8,
        };
        const blankPixels = await receiver.page.screenshot({
          clip: baselineContentBox,
        });

        await receiver.page.evaluate(() => window.scrollTo(0, 0));
        await receiverFocusInput.focus();
        await expect(receiverFocusInput).toBeFocused();

        await senderInput.fill(String(value));
        await sender.page.waitForTimeout(1_500);

        await receiverInput.scrollIntoViewIfNeeded();
        const valueBox = await receiverInput.boundingBox();
        expect(valueBox, `${targetName} has no value box`).not.toBeNull();
        if (!valueBox) throw new Error(`${targetName} has no value box.`);
        const valueContentBox = {
          x: valueBox.x + 8,
          y: valueBox.y + 4,
          width: valueBox.width - 16,
          height: valueBox.height - 8,
        };
        const valuePixels = await receiver.page.screenshot({
          clip: valueContentBox,
        });
        const storedAtCapture = await readStoredScore(
          receiver.page,
          playerIndex,
          target.section,
          target.field,
        );
        const domValueAtCapture = await receiverInput.inputValue();

        if (
          storedAtCapture !== value ||
          domValueAtCapture !== String(value) ||
          !valuePixels.equals(blankPixels)
        ) {
          await expect
            .poll(
              () =>
                readStoredScore(
                  receiver.page,
                  playerIndex,
                  target.section,
                  target.field,
                ),
              { message: `${targetName} did not reach receiver storage` },
            )
            .toBe(value);
          await expect(receiverInput).toHaveValue(String(value));
          continue;
        }

        await receiver.page.evaluate(() => window.scrollTo(0, 0));
        await receiverInput.scrollIntoViewIfNeeded();
        const afterScrollPixels = await receiver.page.screenshot({
          clip: valueContentBox,
        });

        await receiver.page.evaluate(() => window.scrollTo(0, 0));
        await receiverFocusInput.fill(String((fieldIndex + playerIndex) % 10));
        await receiverFocusInput.evaluate((input) => input.blur());
        await receiverInput.scrollIntoViewIfNeeded();
        const afterEditBox = await receiverInput.boundingBox();
        if (!afterEditBox) throw new Error(`${targetName} has no post-edit box.`);
        const afterEditContentBox = {
          x: afterEditBox.x + 8,
          y: afterEditBox.y + 4,
          width: afterEditBox.width - 16,
          height: afterEditBox.height - 8,
        };
        const afterUnrelatedEditPixels = await receiver.page.screenshot({
          clip: afterEditContentBox,
        });

        await receiverInput.evaluate((input) =>
          input.focus({ preventScroll: true }),
        );
        const focusedPixels = await receiver.page.screenshot({
          clip: afterEditContentBox,
        });
        await receiverInput.evaluate((input) => input.blur());
        const blurredPixels = await receiver.page.screenshot({
          clip: afterEditContentBox,
        });

        blankTargets.push({
          targetName,
          remainedBlankAfterScroll: afterScrollPixels.equals(blankPixels),
          remainedBlankAfterUnrelatedEdit:
            afterUnrelatedEditPixels.equals(blankPixels),
          appearedOnFocus: !focusedPixels.equals(blankPixels),
          persistedAfterBlur: !blurredPixels.equals(blankPixels),
          writes: (await readInputValueWrites(receiver.page)).filter(
            (write) => write.index === inputIndex,
          ),
        });
      }
    }

    expect(
      blankTargets,
      `Offscreen first values remained blank: ${JSON.stringify(blankTargets)}`,
    ).toEqual([]);

    const writes = await readInputValueWrites(receiver.page);
    const missingWrites = expectedWrites.filter(
      (expected) =>
        !writes.some(
          (write) =>
            write.index === expected.index && write.after === expected.value,
        ),
    );
    expect(
      missingWrites,
      `React did not reach the native value setter for: ${JSON.stringify(missingWrites)}`,
    ).toEqual([]);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('passive offscreen recovery sequence for external capture', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'webkit-gtk-iphone',
    'External framebuffer capture requires headed GTK WebKit.',
  );

  const playerCount = 4;
  const targetInputIndex = 9 * playerCount + 3;
  const targetValue = 42;
  const roomId = `playwright-passive-capture-${crypto.randomUUID()}`;
  const sender = await openClient(browser, roomId, devices['iPhone 13']);
  const receiver = await openClient(
    browser,
    roomId,
    devices['iPhone 13'],
    true,
  );

  try {
    const addPlayerButton = sender.page.getByRole('button', {
      name: 'Spieler hinzufügen',
    });
    for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
      await addPlayerButton.click();
    }

    const senderInputs = sender.page.locator('input[inputmode="numeric"]');
    const receiverInputs = receiver.page.locator('input[inputmode="numeric"]');
    await expect(receiverInputs).toHaveCount(
      playerCount * EDITABLE_SCORE_FIELDS.length,
    );

    const receiverFocusInput = receiverInputs.first();
    const targetInput = receiverInputs.nth(targetInputIndex);

    // Arm the trigger without ever bringing the lower target into the viewport.
    await receiver.page.evaluate(() => window.scrollTo(0, 0));
    await receiverFocusInput.focus();
    await receiver.page.waitForTimeout(3_000);
    await sender.page.bringToFront();
    await senderInputs.nth(targetInputIndex).fill(String(targetValue));
    await sender.page.waitForTimeout(3_000);

    // Observe after normal scrolling, without reading receiver state or pixels.
    await receiver.page.bringToFront();
    await targetInput.scrollIntoViewIfNeeded();
    await receiver.page.waitForTimeout(4_000);
    await receiver.page.evaluate(() => window.scrollTo(0, 0));
    await receiver.page.waitForTimeout(1_000);
    await targetInput.scrollIntoViewIfNeeded();
    await receiver.page.waitForTimeout(4_000);

    // Edit a different input, then return to the target.
    await receiver.page.evaluate(() => window.scrollTo(0, 0));
    await receiverFocusInput.fill('7');
    await receiverFocusInput.evaluate((input) => input.blur());
    await targetInput.scrollIntoViewIfNeeded();
    await receiver.page.waitForTimeout(4_000);

    // Finally focus only the affected input without scrolling it.
    await targetInput.evaluate((input) => input.focus({ preventScroll: true }));
    await receiver.page.waitForTimeout(4_000);

    await expect
      .poll(() => readStoredScore(receiver.page, 3, 'lower', 'chance'))
      .toBe(targetValue);
    await expect(targetInput).toHaveValue(String(targetValue));
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test('never-visible lower inputs paint their first remote value', async ({
  browser,
}, testInfo) => {
  const playerCount = 4;
  const roomId = `playwright-never-visible-${crypto.randomUUID()}`;
  const contextOptions =
    testInfo.project.name.includes('iphone')
      ? devices['iPhone 13']
      : devices['Desktop Safari'];
  const sender = await openClient(browser, roomId, contextOptions);
  const receiver = await openClient(browser, roomId, contextOptions, true);

  try {
    const addPlayerButton = sender.page.getByRole('button', {
      name: 'Spieler hinzufügen',
    });
    for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
      await addPlayerButton.click();
    }

    const senderInputs = sender.page.locator('input[inputmode="numeric"]');
    const receiverInputs = receiver.page.locator('input[inputmode="numeric"]');
    await expect(receiverInputs).toHaveCount(
      playerCount * EDITABLE_SCORE_FIELDS.length,
    );

    await receiver.page.evaluate(() => window.scrollTo(0, 0));
    await receiverInputs.first().focus();

    const lowerFields = EDITABLE_SCORE_FIELDS.filter(
      (target) => target.section === 'lower',
    );
    const expectedValues = new Map<number, number>();

    // Player zero remains empty in each row and becomes the visual reference.
    for (const [fieldIndex, target] of lowerFields.entries()) {
      for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
        const inputIndex = target.inputRowIndex * playerCount + playerIndex;
        const value = 50 + fieldIndex * (playerCount - 1) + playerIndex;
        expectedValues.set(inputIndex, value);
        await senderInputs.nth(inputIndex).fill(String(value));
      }
    }
    await sender.page.waitForTimeout(2_000);

    const blankTargets: string[] = [];
    for (const target of lowerFields) {
      const referenceInput = receiverInputs.nth(target.inputRowIndex * playerCount);
      await referenceInput.scrollIntoViewIfNeeded();
      const referenceBox = await referenceInput.boundingBox();
      if (!referenceBox) throw new Error(`${target.field} reference has no box.`);
      const referencePixels = await receiver.page.screenshot({
        clip: {
          x: referenceBox.x + 8,
          y: referenceBox.y + 4,
          width: referenceBox.width - 16,
          height: referenceBox.height - 8,
        },
      });

      for (let playerIndex = 1; playerIndex < playerCount; playerIndex += 1) {
        const inputIndex = target.inputRowIndex * playerCount + playerIndex;
        const receiverInput = receiverInputs.nth(inputIndex);
        await receiverInput.scrollIntoViewIfNeeded();
        const inputBox = await receiverInput.boundingBox();
        if (!inputBox) throw new Error(`${target.field}[${playerIndex}] has no box.`);
        const valuePixels = await receiver.page.screenshot({
          clip: {
            x: inputBox.x + 8,
            y: inputBox.y + 4,
            width: inputBox.width - 16,
            height: inputBox.height - 8,
          },
        });
        const expectedValue = expectedValues.get(inputIndex);
        if (expectedValue === undefined)
          throw new Error(`Missing expected value for input ${inputIndex}.`);

        const storedValue = await readStoredScore(
          receiver.page,
          playerIndex,
          target.section,
          target.field,
        );
        const domValue = await receiverInput.inputValue();
        if (
          storedValue === expectedValue &&
          domValue === String(expectedValue) &&
          valuePixels.equals(referencePixels)
        ) {
          blankTargets.push(`${target.field}[${playerIndex}]`);
        }
      }
    }

    expect(
      blankTargets,
      `Never-visible first values remained blank: ${blankTargets.join(', ')}`,
    ).toEqual([]);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});
