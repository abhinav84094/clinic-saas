
import { getTemplate } from "./templates/templateRegistry";

export default function ClinicTemplateRenderer({
  templateId,
  ...props
}) {
  const Template = getTemplate(templateId);

  return <Template {...props} />;
}
