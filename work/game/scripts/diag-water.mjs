import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 60000
});

const page = await app.firstWindow();
try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 60000});
  await page.evaluate(() => {
    window.__game.begin();
    document.querySelector('#modal')?.classList.add('hidden');
    document.querySelector('#hud')?.classList.add('hidden');
  });
  await page.waitForTimeout(1000);

  const diag = await page.evaluate(() => {
    const g = window.__game, w = g.world, b = w.items.bottle;
    w.prepareFrame = () => {};
    w.update = () => {};

    // Position bottle in front of camera
    const distance = 0.42, center = 0.112;
    b.quaternion.copy(w.camera.quaternion);
    const anchor = b.position.clone().set(0, center, 0).applyQuaternion(b.quaternion);
    b.position.set(0, 0, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
    w.scene.updateMatrixWorld(true);

    w.liquid.update(0.85, w.time);
    w.scene.updateMatrixWorld(true);

    const m = b.matrixWorld.elements;
    return {
      bottlePos: {x: b.position.x, y: b.position.y, z: b.position.z},
      bottleWorldY: m[13],
      liquidLevel: w.liquid.level,
      planeConstant: w.liquid.plane.constant,
      planeNormal: {x: w.liquid.plane.normal.x, y: w.liquid.plane.normal.y, z: w.liquid.plane.normal.z},
      volumeVisible: w.liquid.volume.visible,
      volumeParent: w.liquid.volume.parent?.name || w.liquid.volume.parent?.constructor?.name,
      surfaceVisible: w.liquid.surface.visible,
      surfacePos: {x: w.liquid.surface.position.x, y: w.liquid.surface.position.y, z: w.liquid.surface.position.z},
      surfaceParent: w.liquid.surface.parent?.name || w.liquid.surface.parent?.constructor?.name,
      volumeMat: {
        color: w.liquid.volume.material.color.getHexString(),
        opacity: w.liquid.volume.material.opacity,
        transparent: w.liquid.volume.material.transparent,
        transmission: w.liquid.volume.material.transmission,
        depthWrite: w.liquid.volume.material.depthWrite,
        side: w.liquid.volume.material.side
      },
      petMat: {
        color: w.petMat.color.getHexString(),
        opacity: w.petMat.opacity,
        transparent: w.petMat.transparent,
        transmission: w.petMat.transmission,
        depthWrite: w.petMat.depthWrite
      },
      localClipping: w.renderer.localClippingEnabled
    };
  });

  console.log('DIAGNOSTICS:', JSON.stringify(diag, null, 2));

  // Test rendering without PET shell to see water directly
  await page.evaluate(() => {
    const w = window.__game.world;
    w.heroProps.bottle.visible = false; // Hide outer PET shell
    w.heroProps.bottleLabel.visible = false;
    w.render();
  });
  await page.screenshot({path: path.resolve('qa/diag_water_only.png')});

  // Test rendering with PET shell
  await page.evaluate(() => {
    const w = window.__game.world;
    w.heroProps.bottle.visible = true;
    w.heroProps.bottleLabel.visible = true;
    w.render();
  });
  await page.screenshot({path: path.resolve('qa/diag_water_with_pet.png')});

} finally {
  await app.close();
}
