// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './download-file'

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('revokes the object URL after initiating the download', () => {
    const createObjectURL = vi.fn(() => 'blob:practice-backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const blob = new Blob(['backup'])

    downloadBlob(blob, 'backup.json')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:practice-backup')
  })

  it('revokes the object URL when initiating the download throws', () => {
    const createObjectURL = vi.fn(() => 'blob:practice-backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Download could not be started')
    })

    expect(() => downloadBlob(new Blob(['backup']), 'backup.json'))
      .toThrow('Download could not be started')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:practice-backup')
  })
})
