// 테이블 본문이 비었을 때 colSpan 으로 한 줄 안내를 보여주는 행. 카드 목록의 빈 상태는 EmptyState 를 쓴다.
export default function TableEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="td-center td-muted">{message}</td>
    </tr>
  );
}
