import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ workId: string }>;
};

export default async function WorkRootPage({ params }: Props) {
  const { workId } = await params;
  redirect(`/works/${workId}/scenes`);
}
