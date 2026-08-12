import React from 'react';
import Image from 'next/image';
import externalIcon from '@root/assets/ProjectTags/project-type-external.png';
import internalIcon from '@root/assets/ProjectTags/project-type-internal.png';
import { TagProject } from '../TagProject';

interface ProjectTypeTagProps {
  readonly value: string;
}

export function ProjectTypeTag(props: ProjectTypeTagProps) {
  const { value } = props;
  let icon = internalIcon;
  if (value === 'interno') {
    icon = externalIcon;
  }
  return (
    <TagProject icon={<Image src={icon} alt="project type" width={8} height={12} />} text={value} />
  );
}
