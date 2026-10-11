
import TemplateA from "./TemplateA";
import TemplateB from "./TemplateB";
import TemplateC from "./TemplateC";

export const templateRegistry = {
  A: TemplateA,
  B: TemplateB,
  C: TemplateC,
};

export const availableTemplates = [
  {
    id: "A",
    name: "Classic Care",
    description: "Simple, familiar clinic website",
  },
  {
    id: "B",
    name: "Modern Care",
    description: "Fresh, modern healthcare design",
  },
  {
    id: "C",
    name: "Signature Clinic",
    description: "Premium, elegant specialist website",
  },
];

export function getTemplate(templateId) {
  return templateRegistry[templateId] || TemplateA;
}
