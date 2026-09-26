import React from 'react'
import logoCircular from '@/assets/image-7ef0a.png'
import logoHorizontal from '@/assets/image-3f9ef.png'
import { cn } from '@/lib/utils'

export interface LogoFauspProps {
  /**
   * 'circular': marca circular monogramática FAUSP
   * 'horizontal': logotipo horizontal FAUSP · Faculdade Unida de São Paulo . EAD
   */
  variant?: 'circular' | 'horizontal'
  /**
   * 'dark': Quando a logo está sobre fundo escuro (ex: navy #0f2b48).
   *         Aplica badge/card institucional branco arredondado para garantir legibilidade e nitidez sem vazamento grosseiro.
   * 'light': Quando a logo está sobre fundo claro (ex: branco, slate-50).
   * 'transparent': Renderiza a imagem diretamente com a classe passada.
   */
  theme?: 'dark' | 'light' | 'transparent'
  /**
   * Tamanho pré-definido ou customizado via className
   */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  imgClassName?: string
  alt?: string
}

const SIZE_MAP = {
  circular: {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  },
  horizontal: {
    sm: 'h-6 w-auto max-w-[130px]',
    md: 'h-8 w-auto max-w-[160px]',
    lg: 'h-10 w-auto max-w-[210px]',
    xl: 'h-12 w-auto max-w-[260px]',
  },
}

export const LogoFausp: React.FC<LogoFauspProps> = ({
  variant = 'circular',
  theme = 'light',
  size = 'md',
  className,
  imgClassName,
  alt = variant === 'circular'
    ? 'FAUSP - Faculdade Unida de São Paulo'
    : 'FAUSP - Faculdade Unida de São Paulo · EAD',
}) => {
  const src = variant === 'circular' ? logoCircular : logoHorizontal

  // Quando sobre fundo escuro (ex: sidebar navy #0f2b48, banner navy):
  // Usamos um chip/container institucional arredondado com fundo branco nítido e sutil sombra/borda
  if (theme === 'dark') {
    if (variant === 'circular') {
      const containerSizes: Record<string, string> = {
        sm: 'h-8 w-8 p-1',
        md: 'h-10 w-10 p-1.5',
        lg: 'h-12 w-12 p-2',
        xl: 'h-16 w-16 p-2.5',
      }
      return (
        <div
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-white/20 transition-transform',
            containerSizes[size] || 'h-10 w-10 p-1.5',
            className,
          )}
        >
          <img
            src={src}
            alt={alt}
            className={cn('h-full w-full object-contain', imgClassName)}
            loading="eager"
          />
        </div>
      )
    }

    // Horizontal sobre dark
    const containerSizes: Record<string, string> = {
      sm: 'px-2.5 py-1 rounded-md',
      md: 'px-3 py-1.5 rounded-lg',
      lg: 'px-3.5 py-2 rounded-lg',
      xl: 'px-4 py-2.5 rounded-xl',
    }
    return (
      <div
        className={cn(
          'inline-flex shrink-0 items-center justify-center bg-white shadow-sm ring-1 ring-white/20 transition-transform',
          containerSizes[size] || 'px-3 py-1.5 rounded-lg',
          className,
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn(SIZE_MAP.horizontal[size] || 'h-8 w-auto', 'object-contain', imgClassName)}
          loading="eager"
        />
      </div>
    )
  }

  // Sobre fundo claro ou transparente direto
  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-contain shrink-0', SIZE_MAP[variant][size], className, imgClassName)}
      loading="eager"
    />
  )
}

export default LogoFausp
