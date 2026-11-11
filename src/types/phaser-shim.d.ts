/**
 * Los tipos de Phaser 3.90 mencionan `ActiveXObject` (herencia de Internet
 * Explorer), que TypeScript 7 ya no incluye en su biblioteca DOM. Esta
 * declaración mínima permite comprobar los tipos sin desactivar `skipLibCheck`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ActiveXObject {}
