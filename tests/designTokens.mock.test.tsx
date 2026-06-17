// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderMock } from './helpers/mockApp'
import { AppearancePanel } from '../src/pages/SettingsPage'
import { applyTokenVars, getToken } from '../src/lib/designTokens'
import { getSettings, useSettings } from '../src/store/settings'

// AppearancePanel is prop-driven; feed it the live store so a control change
// (which calls updateSettings) re-renders against the new state.
function Panel() {
  const [settings, update] = useSettings()
  return <AppearancePanel settings={settings} update={update} />
}

const renderPanel = () => renderMock(<Panel />)

describe('AppearancePanel — design tokens', () => {
  it('groups controls by category', () => {
    renderPanel()
    for (const title of ['Accent', 'Typography', 'Spacing', 'Corner radius']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
  })

  it('persists a color edit to settings.tokens', async () => {
    const user = userEvent.setup()
    renderPanel()
    const field = screen.getByLabelText('Primary accent value') as HTMLInputElement
    await user.clear(field)
    await user.type(field, '#ff0000')
    await user.tab() // blur commits
    expect(getSettings().tokens['accent.primary']).toBe('#ff0000')
    expect(getToken(getSettings(), 'accent.primary')).toBe('#ff0000')
  })

  it('persists a length-slider edit with its unit', async () => {
    renderPanel()
    const slider = screen.getByLabelText('Spacing unit value') as HTMLInputElement
    // jsdom doesn't drive range drag; fire the change through React's tracker.
    fireEvent.change(slider, { target: { value: '0.3' } })
    expect(getSettings().tokens['spacing.base']).toBe('0.3rem')
  })

  it('fonts are dropdowns whose choice persists', async () => {
    const user = userEvent.setup()
    renderPanel()
    const select = screen.getByLabelText('UI font value') as HTMLSelectElement
    await user.selectOptions(select, 'Verdana, Geneva, Tahoma, sans-serif')
    expect(getSettings().tokens['font.sans']).toBe('Verdana, Geneva, Tahoma, sans-serif')
  })

  it('Reset all clears every override', async () => {
    const user = userEvent.setup()
    renderPanel()
    const field = screen.getByLabelText('Primary accent value') as HTMLInputElement
    await user.clear(field)
    await user.type(field, '#123456')
    await user.tab()
    expect(Object.keys(getSettings().tokens).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Reset all' }))
    expect(getSettings().tokens).toEqual({})
  })

  it('applyTokenVars writes overrides to :root and clears them on reset', () => {
    const root = document.documentElement
    applyTokenVars({ ...getSettings(), tokens: { 'accent.primary': '#abcdef', 'radius.lg': '1rem' } })
    expect(root.style.getPropertyValue('--color-emerald-500')).toBe('#abcdef')
    expect(root.style.getPropertyValue('--radius-lg')).toBe('1rem')

    applyTokenVars({ ...getSettings(), tokens: {} })
    expect(root.style.getPropertyValue('--color-emerald-500')).toBe('')
    expect(root.style.getPropertyValue('--radius-lg')).toBe('')
  })
})
