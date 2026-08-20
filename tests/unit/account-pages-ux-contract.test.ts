import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('account page UX contracts', () => {
  it('uses the real session user and performs an actual reload on the profile tags page', () => {
    const page = read('qianfu-liandeng/src/pages/ProfileTags.tsx');

    expect(page).toContain('useAuthStore((state) => state.user)');
    expect(page).toContain('userId={user.id}');
    expect(page).toContain('setRefreshKey((key) => key + 1)');
    expect(page).not.toContain("'current-user-id'");
    expect(page).not.toContain('value="--"');
    expect(page).not.toContain('matrix-badge mb-6');
    expect(page).not.toContain("text-7xl font-black tracking-tighter uppercase italic leading-none mb-6");
  });

  it('keeps retired billing surfaces closed in account modules', () => {
    const profile = read('qianfu-liandeng/src/pages/Profile.tsx');
    const billing = read('qianfu-liandeng/src/pages/Billing.tsx');

    expect(profile).not.toContain("to: '/dashboard/billing'");
    expect(profile).not.toContain('to="/payment"');
    expect(billing).toContain("from './CommercialFeatureDisabled'");
    expect(billing).toContain('<CommercialFeatureDisabled />');
  });

  it('uploads and persists avatars while keeping the login email read-only', () => {
    const page = read('qianfu-liandeng/src/pages/ProfileEdit.tsx');

    expect(page).toContain("api.post<{ data?: { url: string }; url?: string }>('/upload'");
    expect(page).toContain("api.put<User>('/profile', { avatar_url: avatarUrl })");
    expect(page).toContain('onChange={onAvatarChange}');
    expect(page).toContain('value={user?.email || \'\'}');
    expect(page).toContain('readOnly');
    expect(page).not.toContain("profileForm.register('email')");
  });

  it('supports drag-and-drop avatars and edits the public profile fields', () => {
    const page = read('qianfu-liandeng/src/pages/ProfileEdit.tsx');

    expect(page).toContain('onDragOver={onAvatarDragOver}');
    expect(page).toContain('onDrop={onAvatarDrop}');
    expect(page).toContain("profileForm.register('display_name')");
    expect(page).toContain("profileForm.register('bio_html')");
    expect(page).toContain('avatarError');
    expect(page).toContain('role="alert"');
  });

  it('keeps the account profile focused on platform identity instead of game skin previews', () => {
    const profile = read('qianfu-liandeng/src/pages/Profile.tsx');
    const dashboard = read('qianfu-liandeng/src/pages/Dashboard.tsx');

    expect(profile).not.toContain('ThreeDHeadShowcase');
    expect(profile).not.toContain('角色皮肤');
    expect(dashboard).toContain('<aside className="w-full shrink-0 self-start space-y-3 md:w-64 xl:w-72">');
    expect(dashboard).not.toContain('lg:sticky');
    expect(dashboard).not.toContain('lg:fixed');
  });

  it('does not disguise mobile message request failures as an empty inbox', () => {
    const messages = read('qianfu-liandeng/src/components/mobile/MobileMessages.tsx');
    const tickets = read('qianfu-liandeng/src/components/mobile/MobileTicketCreate.tsx');

    expect(messages).toContain('notificationQuery.isError || ticketQuery.isError');
    expect(messages).toContain('消息加载失败');
    expect(messages).toContain('notificationQuery.refetch()');
    expect(tickets).toContain("title: '提交失败'");
  });

  it('keeps ticket failures distinct from empty results and uses the canonical detail route', () => {
    const desktop = read('qianfu-liandeng/src/pages/TicketList.tsx');
    const mobile = read('qianfu-liandeng/src/components/mobile/MobileTicketList.tsx');

    expect(desktop).toContain('isError={isError}');
    expect(desktop).toContain('isEmpty={!isLoading && !isError && ticketCards.length === 0}');
    expect(desktop).toContain('href={`/tickets/${ticket.id}`}');
    expect(mobile).toContain('工单加载失败');
    expect(mobile).toContain("to={`/tickets/${ticket.id}`}");
  });

  it('makes favorites reachable in both shells and rejects unsafe image sources', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    const profile = read('qianfu-liandeng/src/pages/Profile.tsx');
    const mobileProfile = read('qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx');
    const favorites = read('qianfu-liandeng/src/pages/MyServerFavorites.tsx');

    expect(app.match(/path="\/me\/favorites"/g)).toHaveLength(2);
    expect(app.match(/path="\/me\/tags"/g)).toHaveLength(2);
    expect(profile).toContain('to="/me/favorites"');
    expect(mobileProfile).toContain("path: '/me/favorites'");
    expect(profile).toContain('to="/me/tags"');
    expect(mobileProfile).toContain("path: '/me/tags'");
    expect(favorites).toContain('isImageUrlSafe(url)');
    expect(favorites).not.toContain("['https:', 'data:']");
    expect(favorites).not.toContain('usePrefetchFavorites');
  });

  it('keeps retired marketplace favorites out of account navigation', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    const page = read('qianfu-liandeng/src/pages/MarketplaceFavorites.tsx');

    expect(app).not.toContain('path="/marketplace/favorites"');
    expect(page).toContain('favoritesQuery.isError');
    expect(page).toContain('商品收藏加载失败');
  });
});
