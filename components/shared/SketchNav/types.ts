interface NavTarget {
  slug: string;
  title: string;
}

export interface SketchNavProps {
  prev: NavTarget | null;
  next: NavTarget | null;
}
