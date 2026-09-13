/**
 * Public drawer component used by the chat screen.
 *
 * The implementation stays in SideMenu so existing gestures, real conversation
 * data, search, profile, deletion and localization behavior remain intact.
 */
export { default } from "@/components/SideMenu";
export type { SideMenuHandle as SideDrawerHandle } from "@/components/SideMenu";