
import TemplateA from "./TemplateA";

export const templateRegistry = {
  A: TemplateA,
};

export const availableTemplates = [
  {
    id: "A",
    name: "Template A",
    description: "Clinic website layout",
  },
];

export function getTemplate(templateId) {
  return templateRegistry[templateId] || TemplateA;
}
