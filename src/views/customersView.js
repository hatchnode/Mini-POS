import { customerStats, rewardStatus } from '../domain/customers.js';
import { store } from '../state/store.js';
import { money } from '../ui/format.js';
import { timeAgo } from '../utils/date.js';
import { esc, plural } from '../utils/text.js';

/** Regular customers, biggest spenders first, with their stamp-card progress. Edit in place. */
export function renderCustomersTab() {
  const { data } = store;
  const perReward = Number(data.settings.loyaltyVisits) || 0;
  const stats = customerStats(data);
  const of = (c) => stats.get(c.id) || { visits: 0, spent: 0, lastVisit: null };
  const rows = [...data.customers]
    .sort((a, b) => of(b).spent - of(a).spent || b.createdAt - a.createdAt)
    .map((c) => {
      const s = of(c);
      const reward = rewardStatus(c, s.visits, perReward);
      let stamp = '<span class="muted">off</span>';
      if (reward)
        stamp = reward.due
          ? `<span class="pill paid">${reward.due} reward${reward.due > 1 ? 's' : ''} due</span>`
          : `${reward.progress}/${reward.perReward}`;
      return `<tr>
        <td><input value="${esc(c.name)}" data-change="renameCustomer" data-id="${c.id}" aria-label="Name" maxlength="60"></td>
        <td><input type="tel" value="${esc(c.phone)}" data-change="setCustomerPhone" data-id="${c.id}" aria-label="Phone" maxlength="30" placeholder="—"></td>
        <td class="n">${s.visits}</td>
        <td class="n">${money(s.spent)}</td>
        <td>${s.lastVisit ? timeAgo(s.lastVisit) : '—'}</td>
        <td>${stamp}</td>
        <td class="acts"><button class="small btn-danger" data-act="deleteCustomer" data-id="${c.id}">Delete</button></td>
      </tr>`;
    })
    .join('');
  const rule = perReward
    ? `Reward: <b>${esc(data.settings.loyaltyReward || 'Reward')}</b> after every ${plural(perReward, 'paid visit')}. Change it in Settings.`
    : 'Rewards are off. Turn them on in Settings.';
  return `<section class="panel"><div class="panel-h"><h2>Customers</h2><span class="muted small">${data.customers.length}</span></div>
    <div class="panel-b form">
      <p class="muted flush">Add a customer to an order from its ticket (<b>+ Add customer</b>). A visit counts once the bill is paid. ${rule}</p>
      <form class="addcust" data-submit="addCustomer">
        <input name="cname" placeholder="Customer name" required maxlength="60">
        <input name="cphone" type="tel" placeholder="Phone (optional)" maxlength="30">
        <button class="btn-primary">Add customer</button>
      </form>
    </div>
    ${
      rows
        ? `<div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Phone</th><th class="n">Paid visits</th><th class="n">Spent</th><th>Last visit</th><th>Reward card</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<div class="empty">No customers yet.</div>'
    }
  </section>`;
}
