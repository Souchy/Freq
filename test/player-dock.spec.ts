import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayerDock } from '../src/components/player-dock/player-dock';

describe('player dock interactions', () => {
  let dock: PlayerDock;

  beforeEach(() => {
    dock = new PlayerDock();
    dock.attached();
  });

  afterEach(() => {
    dock.detaching();
    document.body.replaceChildren();
  });

  function createDockSurface() {
    const surface = document.createElement('section');
    surface.className = 'player-dock';
    surface.addEventListener('click', event => dock.onDockClick(event));
    document.body.append(surface);
    return surface;
  }

  it('expands when the dock surface is clicked, even if its content is replaced', () => {
    const surface = createDockSurface();
    const artwork = document.createElement('div');
    surface.append(artwork);
    surface.addEventListener('click', () => artwork.remove());

    artwork.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dock.isExpanded).toBe(true);
  });

  it('minimizes when the expanded dock surface is clicked', () => {
    const surface = createDockSurface();
    const artwork = document.createElement('div');
    surface.append(artwork);
    dock.isExpanded = true;

    artwork.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dock.isExpanded).toBe(false);
  });

  it('does not toggle when transport buttons or sliders are clicked', () => {
    const surface = createDockSurface();
    const button = document.createElement('button');
    const slider = document.createElement('input');
    slider.type = 'range';
    surface.append(button, slider);
    let buttonActivated = false;
    button.addEventListener('click', () => buttonActivated = true);

    button.click();
    slider.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(buttonActivated).toBe(true);
    expect(dock.isExpanded).toBe(false);
  });

  it('minimizes when a click lands outside the dock', () => {
    dock.isExpanded = true;

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dock.isExpanded).toBe(false);
  });

  it('toggles with Enter and Space when the dock surface is focused', () => {
    const surface = createDockSurface();
    surface.tabIndex = 0;
    surface.addEventListener('keydown', event => dock.onDockKeydown(event));

    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(dock.isExpanded).toBe(true);

    surface.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(dock.isExpanded).toBe(false);
  });
});