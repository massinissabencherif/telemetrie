import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { marked } from 'marked'
import { chromium } from 'playwright'

export function fillTemplate(markdown, values) {
  let filled = markdown

  for (const [token, value] of Object.entries(values)) {
    filled = filled.replaceAll(`{{${token}}}`, String(value))
  }

  return filled
}

const PDF_STYLES = `
  body {
    color: #1f2933;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    margin: 0 auto;
    max-width: 800px;
  }

  h1 {
    border-bottom: 2px solid #1f2933;
    font-size: 28px;
    line-height: 1.2;
    margin: 0 0 20px;
    padding-bottom: 8px;
  }

  h2 {
    break-after: avoid;
    color: #102a43;
    font-size: 20px;
    line-height: 1.25;
    margin: 28px 0 10px;
  }

  p,
  li {
    orphans: 3;
    widows: 3;
  }

  blockquote {
    border-left: 4px solid #bcccdc;
    color: #52606d;
    margin: 0 0 18px;
    padding: 4px 0 4px 12px;
  }

  img {
    border: 1px solid #d9e2ec;
    border-radius: 4px;
    display: block;
    margin: 10px 0 14px;
    max-height: 760px;
    max-width: 100%;
    object-fit: contain;
  }

  table {
    border-collapse: collapse;
    margin: 12px 0 16px;
    width: 100%;
  }

  th,
  td {
    border: 1px solid #d9e2ec;
    padding: 7px 9px;
    text-align: left;
  }

  th {
    background: #f0f4f8;
  }

  code {
    background: #f0f4f8;
    border-radius: 3px;
    font-size: 0.94em;
    padding: 1px 4px;
  }
`

function absolutizeMarkdownImages(markdown, baseDir) {
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (/^(https?:|file:)/.test(src)) return match

    const absolute = path.resolve(baseDir, src)
    return `![${alt}](${pathToFileURL(absolute).href})`
  })
}

export async function renderPdf(markdownPath, outputPdfPath, values) {
  const raw = await readFile(markdownPath, 'utf-8')
  const filled = fillTemplate(raw, values)
  const baseDir = path.dirname(markdownPath)
  const markdownWithImages = absolutizeMarkdownImages(filled, baseDir)
  const html = marked.parse(markdownWithImages)
  const styledHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${html}</body></html>`

  await mkdir(path.dirname(outputPdfPath), { recursive: true })

  const tempDir = await mkdtemp(path.join(tmpdir(), 'eshop-report-'))
  const tempHtmlPath = path.join(tempDir, 'report.html')
  await writeFile(tempHtmlPath, styledHtml, 'utf-8')

  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()
    await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: 'networkidle' })
    await page.pdf({
      path: outputPdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true
    })
  } finally {
    await browser.close()
  }
}
