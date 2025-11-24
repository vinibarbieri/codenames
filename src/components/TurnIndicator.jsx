/**
 * TurnIndicator - Componente que indica o turno atual e role do jogador
 *
 * @component
 * @param {Object} props - Propriedades do componente
 * @param {'red'|'blue'} props.currentTurn - Equipe do turno atual
 * @param {'red'|'blue'} [props.myTeam] - Equipe do jogador atual
 * @param {'spymaster'|'operative'} [props.myRole] - Role do jogador atual
 *
 * @example
 * <TurnIndicator
 *   currentTurn="red"
 *   myTeam="red"
 *   myRole="spymaster"
 * />
 */
const TurnIndicator = ({ currentTurn, myTeam, myRole }) => {
  const isMyTurn = currentTurn === myTeam;
  const teamNames = {
    red: 'Equipe Vermelha',
    blue: 'Equipe Azul',
  };

  const roleNames = {
    spymaster: 'Espião Mestre',
    operative: 'Operativo',
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full ${currentTurn === 'red' ? 'bg-red-500' : 'bg-blue-500'} animate-pulse`}
        />
        <h3 className="text-lg font-bold text-secondary-900 dark:text-white">
          Turno: {teamNames[currentTurn]}
        </h3>
      </div>

      {myTeam && myRole && (
        <div className="text-sm text-secondary-700 dark:text-secondary-300">
          <span className={isMyTurn ? 'font-semibold text-primary-600 dark:text-primary-400' : ''}>
            Você: {teamNames[myTeam]} - {roleNames[myRole]}
          </span>
          {isMyTurn && (
            <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900 px-2 py-1 rounded">
              Seu turno!
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TurnIndicator;

