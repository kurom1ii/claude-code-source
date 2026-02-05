/**
 * Theme System - Quan ly mau sac va themes cho Claude Code
 *
 * Ho tro light/dark themes va custom theme colors.
 * Pattern tu source: switch(VAR){case"light":return...;case"dark":return...}
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Cac mau trong theme
 */
export interface ThemeColors {
  /** Mau chinh (primary actions, highlights) */
  primary: string;

  /** Mau phu (secondary text, borders) */
  secondary: string;

  /** Mau nen */
  background: string;

  /** Mau text chinh */
  text: string;

  /** Mau error */
  error: string;

  /** Mau warning */
  warning: string;

  /** Mau success */
  success: string;

  /** Mau info */
  info: string;

  /** Mau cho permission dialogs */
  permission: string;

  /** Mau cho "remember" options */
  remember: string;

  /** Mau bash border/indicator */
  bashBorder: string;

  /** Mau code blocks */
  code: string;

  /** Mau comments */
  comment: string;

  /** Mau keywords */
  keyword: string;

  /** Mau strings */
  string: string;

  /** Mau numbers */
  number: string;

  /** Mau functions */
  function: string;
}

/**
 * Theme ID
 */
export type ThemeId = 'light' | 'dark' | 'monokai' | 'solarized' | 'custom';

/**
 * Light theme colors
 */
export const LIGHT_THEME: ThemeColors = {
  primary: '#0066cc',
  secondary: '#666666',
  background: '#ffffff',
  text: '#000000',
  error: '#cc0000',
  warning: '#cc6600',
  success: '#00cc00',
  info: '#0066cc',
  permission: '#0099cc',
  remember: '#6600cc',
  bashBorder: '#cc6600',
  code: '#333333',
  comment: '#999999',
  keyword: '#0000cc',
  string: '#cc0000',
  number: '#009900',
  function: '#0066cc',
};

/**
 * Dark theme colors
 */
export const DARK_THEME: ThemeColors = {
  primary: '#66ccff',
  secondary: '#999999',
  background: '#000000',
  text: '#ffffff',
  error: '#ff6666',
  warning: '#ffcc66',
  success: '#66ff66',
  info: '#66ccff',
  permission: '#66ccff',
  remember: '#cc99ff',
  bashBorder: '#ffcc66',
  code: '#cccccc',
  comment: '#666666',
  keyword: '#ff79c6',
  string: '#f1fa8c',
  number: '#bd93f9',
  function: '#50fa7b',
};

/**
 * Monokai theme colors
 */
export const MONOKAI_THEME: ThemeColors = {
  primary: '#a6e22e',
  secondary: '#75715e',
  background: '#272822',
  text: '#f8f8f2',
  error: '#f92672',
  warning: '#e6db74',
  success: '#a6e22e',
  info: '#66d9ef',
  permission: '#66d9ef',
  remember: '#ae81ff',
  bashBorder: '#e6db74',
  code: '#f8f8f2',
  comment: '#75715e',
  keyword: '#f92672',
  string: '#e6db74',
  number: '#ae81ff',
  function: '#a6e22e',
};

/**
 * Solarized dark theme colors
 */
export const SOLARIZED_THEME: ThemeColors = {
  primary: '#268bd2',
  secondary: '#657b83',
  background: '#002b36',
  text: '#839496',
  error: '#dc322f',
  warning: '#b58900',
  success: '#859900',
  info: '#2aa198',
  permission: '#268bd2',
  remember: '#6c71c4',
  bashBorder: '#b58900',
  code: '#93a1a1',
  comment: '#586e75',
  keyword: '#859900',
  string: '#2aa198',
  number: '#d33682',
  function: '#268bd2',
};

/**
 * Built-in themes
 */
export const THEMES: Record<string, ThemeColors> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  monokai: MONOKAI_THEME,
  solarized: SOLARIZED_THEME,
};

/**
 * Lay theme colors theo ID
 */
export function getThemeColors(themeId: ThemeId | string): ThemeColors {
  switch (themeId) {
    case 'light':
      return LIGHT_THEME;
    case 'dark':
      return DARK_THEME;
    case 'monokai':
      return MONOKAI_THEME;
    case 'solarized':
      return SOLARIZED_THEME;
    default:
      return DARK_THEME;
  }
}

/**
 * Theme context type
 */
export interface ThemeContextType {
  /** Theme ID hien tai */
  themeId: ThemeId;

  /** Theme colors hien tai */
  colors: ThemeColors;

  /** Doi theme */
  setTheme: (themeId: ThemeId) => void;

  /** Set custom colors (chi khi themeId = 'custom') */
  setCustomColors: (colors: Partial<ThemeColors>) => void;

  /** Kiem tra dark mode */
  isDark: boolean;
}

/**
 * Theme context
 */
const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Theme provider props
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeId;
  customColors?: Partial<ThemeColors>;
}

/**
 * ThemeProvider Component
 *
 * Wrap app de cung cap theme context.
 *
 * @example
 * ```tsx
 * <ThemeProvider defaultTheme="dark">
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  customColors,
}: ThemeProviderProps): React.ReactElement {
  const [themeId, setThemeId] = useState<ThemeId>(defaultTheme);
  const [custom, setCustom] = useState<Partial<ThemeColors>>(customColors || {});

  // Tinh toan colors hien tai
  const colors: ThemeColors = themeId === 'custom'
    ? { ...DARK_THEME, ...custom }
    : getThemeColors(themeId);

  // Check dark mode
  const isDark = themeId !== 'light';

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
  }, []);

  const setCustomColors = useCallback((newColors: Partial<ThemeColors>) => {
    setCustom(prev => ({ ...prev, ...newColors }));
  }, []);

  const contextValue: ThemeContextType = {
    themeId,
    colors,
    setTheme,
    setCustomColors,
    isDark,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme Hook
 *
 * Lay theme context trong component.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { colors, isDark } = useTheme();
 *   return <Text color={colors.primary}>Hello</Text>;
 * }
 * ```
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    // Fallback khi khong co provider
    return {
      themeId: 'dark',
      colors: DARK_THEME,
      setTheme: () => {},
      setCustomColors: () => {},
      isDark: true,
    };
  }

  return context;
}

/**
 * withTheme HOC
 *
 * Wrap component de inject theme props.
 */
export function withTheme<P extends { theme?: ThemeContextType }>(
  Component: React.ComponentType<P>
): React.FC<Omit<P, 'theme'>> {
  return function ThemedComponent(props: Omit<P, 'theme'>) {
    const theme = useTheme();
    return <Component {...(props as P)} theme={theme} />;
  };
}

/**
 * ThemeSelector Component
 *
 * UI de chon theme.
 */
export function ThemeSelector(): React.ReactElement {
  const { themeId, setTheme, colors } = useTheme();

  const themes: Array<{ id: ThemeId; label: string }> = [
    { id: 'dark', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'monokai', label: 'Monokai' },
    { id: 'solarized', label: 'Solarized' },
  ];

  // Note: Actual UI would use Select component
  // Day chi la placeholder
  return React.createElement('ink-box', { flexDirection: 'column' },
    themes.map(theme =>
      React.createElement('ink-text', {
        key: theme.id,
        color: themeId === theme.id ? colors.primary : undefined,
        bold: themeId === theme.id,
      }, `${themeId === theme.id ? '> ' : '  '}${theme.label}`)
    )
  );
}

export default {
  LIGHT_THEME,
  DARK_THEME,
  MONOKAI_THEME,
  SOLARIZED_THEME,
  getThemeColors,
  ThemeProvider,
  useTheme,
  withTheme,
};
