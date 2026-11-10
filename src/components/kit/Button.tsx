import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../cx';

type Common = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** lg = 19px bold: the only size where brand blue #2582D7 may carry white text. */
  size?: 'sm' | 'md' | 'lg';
  /** Square icon-only button. Always pass aria-label. */
  icon?: boolean;
  children?: ReactNode;
};
type AsButton = Common & ComponentProps<'button'> & { href?: undefined };
type AsLink = Common & ComponentProps<'a'> & { href: string };

export function Button({ variant = 'primary', size = 'md', icon, className, ...rest }: AsButton | AsLink) {
  const cls = cx('dtx-btn', `dtx-btn--${variant}`, size !== 'md' && `dtx-btn--${size}`, icon && 'dtx-btn--icon', className);
  if (rest.href !== undefined) return <a className={cls} {...(rest as ComponentProps<'a'>)} />;
  const { type = 'button', ...btn } = rest as ComponentProps<'button'>;
  return <button type={type} className={cls} {...btn} />;
}
