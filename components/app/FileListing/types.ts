import type { CoreComponent } from '@/types/core';
import type { File } from '@/types/files';

export interface FileListingProps extends Omit<CoreComponent, 'children'> {
  files: File[];
}

export interface MetaFile extends File {
  year: number;
  month: number;
}
