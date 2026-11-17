// Letters (17 Nov 2026): the only remote imports, pinned. render.ts receives
// these as arguments so the Node tests can pass the same versions from npm.
export { PDFDocument, rgb, grayscale } from "https://esm.sh/pdf-lib@1.17.1";
export { default as fontkit } from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
export { default as qrcode } from "https://esm.sh/qrcode-generator@1.4.4";
