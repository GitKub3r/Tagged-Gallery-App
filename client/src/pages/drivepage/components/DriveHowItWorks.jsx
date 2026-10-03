import { faImage, faLink, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { FeatureList } from "../../../components/feature-list/FeatureList";

const ITEMS = [
    { icon: faLink, title: "Linked, not copied", text: "Tagged keeps a reference with your tags, albums and favourites. Originals stay in your Drive." },
    { icon: faImage, title: "Only thumbnails are saved", text: "Small previews are cached so your gallery stays fast without using space on this server." },
    { icon: faShieldHalved, title: "Your Drive stays untouched", text: "Removing media from Tagged never deletes or changes anything in Google Drive." },
];

export const DriveHowItWorks = () => <FeatureList items={ITEMS} />;
