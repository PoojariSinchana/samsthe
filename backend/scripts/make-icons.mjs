import sharp from "sharp";
import fs from "fs";

fs.mkdirSync("public/icons", { recursive: true });
const bg = { r: 255, g: 255, b: 255, alpha: 1 };

for (const app of ["restaurant", "retail"]) {
  for (const [size, file, pad] of [
    [192, `${app}-192.png`, 0.12],
    [512, `${app}-512.png`, 0.12],
    [512, `${app}-maskable-512.png`, 0.25], // extra padding so Android's mask doesn't crop it
  ]) {
    const inner = Math.round(size * (1 - pad * 2));
    const logo = await sharp("public/logo.png")
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
      .composite([{ input: logo }]).png().toFile(`public/icons/${file}`);
  }
}