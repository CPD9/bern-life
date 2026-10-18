import { ChoiceCards } from "./choice-cards";
import { type Visibility, visibilityOptions } from "./profile";

export function VisibilityStep({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ChoiceCards
        legend="Who can see your profile"
        choices={visibilityOptions}
        value={value}
        onChange={onChange}
      />
      <p className="text-sm">
        <strong>Uploads are always private.</strong> Files you add at home are for you only.
      </p>
      <p className="text-muted text-sm">
        Everything you enter here stays in this browser and is not sent to a server. Without an
        account there is nothing for anyone else to see.
      </p>
    </div>
  );
}
