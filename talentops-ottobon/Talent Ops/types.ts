import React from 'react';

export interface TiltedCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  caption?: string;
  delay?: number;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  imageSrc?: string;
}

export interface NavItem {
  id: string;
  label: string;
}

export enum SectionId {
  HERO = 'hero',
  ATLAS = 'atlas',
  FEATURES = 'features',
  ANALYTICS = 'analytics',
  ENABLEMENT = 'enablement',
  ALTAR = 'altar'
}