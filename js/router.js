export const routes = [
  {id:'dashboard', label:'Tổng quan', icon:'dashboard', group:'main'},
  {id:'library', label:'Thư viện tri thức', icon:'library', group:'main'},
  {id:'pareto', label:'Bài học Pareto', icon:'book', group:'main'},
  {id:'practice', label:'Phòng luyện tập', icon:'flask', group:'training'},
  {id:'recall', label:'Active Recall', icon:'brain', group:'training'},
  {id:'srs', label:'Ôn tập Flashcard', icon:'cards', group:'training'},
  {id:'skilltree', label:'Cây kỹ năng', icon:'tree', group:'progress'},
  {id:'braintree', label:'Cây bộ não', icon:'brain', group:'progress'},
  {id:'settings', label:'Cài đặt & dữ liệu', icon:'settings', group:'settings'}
];

export function href(route, params = {}) {
  const search = new URLSearchParams(params).toString();
  return '#' + route + (search ? '?' + search : '');
}

export function currentRoute() {
  const [route, ...query] = location.hash.slice(1).split('?');
  return {route: routes.find(item => item.id === route) ?? routes[0], params: new URLSearchParams(query.join('?'))};
}
